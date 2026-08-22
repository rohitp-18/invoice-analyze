import uuid
from typing import List, Optional
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from langchain_core.documents import Document

from app.database import get_db
from app.models import User, CompliancePolicy
from app.schemas.policy_schema import PolicyCreate, PolicyUpdate, PolicyResponse, PolicyListResponse
from app.authentication import require_compliance_or_admin
from app.ai.vector_store import vector_store_manager

router = APIRouter(prefix="/api/v1/policies", tags=["Compliance & Corporate Policies"])


# Default baseline policy templates
DEFAULT_BASELINE_POLICIES = [
    {
        "policy_code": "POL-CAPEX-001",
        "title": "Capital Expenditure Approval Threshold",
        "category": "THRESHOLD",
        "rule_type": "MAX_AMOUNT",
        "max_amount": 10000.00,
        "currency": "USD",
        "severity": "HIGH",
        "department": "All",
        "description": "Any single invoice exceeding $10,000 requires prior Chief Financial Officer or VP Procurement sign-off.",
    },
    {
        "policy_code": "POL-MEAL-002",
        "title": "Daily Travel & Entertainment Meal Limit",
        "category": "TRAVEL",
        "rule_type": "MAX_AMOUNT",
        "max_amount": 150.00,
        "currency": "USD",
        "severity": "MEDIUM",
        "department": "All",
        "description": "Daily employee meal expense claims must not exceed $150 per person per day.",
    },
    {
        "policy_code": "POL-WEEKEND-003",
        "title": "Non-Business Day Unitemized Spend Prohibition",
        "category": "GENERAL",
        "rule_type": "CATEGORY_RESTRICTION",
        "max_amount": 500.00,
        "currency": "USD",
        "severity": "HIGH",
        "department": "All",
        "description": "Invoices dated on weekends or public holidays without itemized item descriptions are strictly flagged for forensic review.",
    },
    {
        "policy_code": "POL-TAX-004",
        "title": "Mandatory Tax Compliance & Business Registration",
        "category": "TAX",
        "rule_type": "MANDATORY_DOCUMENT",
        "max_amount": None,
        "currency": "USD",
        "severity": "CRITICAL",
        "department": "Finance",
        "description": "All vendor invoices above $1,000 must display a verifiable corporate Tax ID, VAT number, or GSTIN.",
    },
]


def index_policy_in_vector_store(policy: CompliancePolicy):
    """Indexes a single compliance policy document into the active Vector Store (FAISS / Pinecone)."""
    try:
        content = (
            f"Corporate Compliance Policy [{policy.policy_code}]: {policy.title}\n"
            f"Category: {policy.category} | Severity: {policy.severity} | Department: {policy.department or 'All'}\n"
            f"Rule Type: {policy.rule_type} | Max Amount: {f'{policy.max_amount:,.2f} {policy.currency}' if policy.max_amount is not None else 'N/A'}\n"
            f"Enforcement Standard & Criteria: {policy.description}"
        )

        doc = Document(
            page_content=content,
            metadata={
                "type": "compliance_policy",
                "policy_id": str(policy.id),
                "policy_code": policy.policy_code,
                "title": policy.title,
                "category": policy.category,
                "severity": policy.severity,
                "rule_type": policy.rule_type,
                "max_amount": float(policy.max_amount) if policy.max_amount is not None else None,
                "department": policy.department or "All",
                "is_active": policy.is_active,
            },
        )

        vector_store_manager.add_documents([doc])
        print(f"[VectorStore] Indexed compliance policy: {policy.policy_code} ({policy.title})")
    except Exception as e:
        print(f"[VectorStore] Notice: Could not index policy {policy.policy_code}: {e}")


def seed_default_policies_if_empty(db: Session, admin_user: User):
    """Seed baseline corporate policies if the table is empty and index them into Vector DB."""
    count = db.query(CompliancePolicy).count()
    if count == 0:
        created = []
        for pol in DEFAULT_BASELINE_POLICIES:
            new_pol = CompliancePolicy(
                id=uuid.uuid4(),
                policy_code=pol["policy_code"],
                title=pol["title"],
                category=pol["category"],
                rule_type=pol["rule_type"],
                max_amount=pol["max_amount"],
                currency=pol["currency"],
                severity=pol["severity"],
                department=pol["department"],
                description=pol["description"],
                is_active=True,
                created_by_id=admin_user.id,
            )
            db.add(new_pol)
            created.append(new_pol)
        db.commit()

        for p in created:
            db.refresh(p)
            index_policy_in_vector_store(p)

        print("[Compliance] Seeded & Vectorized default corporate compliance policies.")


# ============================================================================
# 1. LIST ALL POLICIES
# ============================================================================
@router.get("", response_model=PolicyListResponse)
def list_policies(
    category: Optional[str] = Query(None, description="Filter by category (THRESHOLD, TRAVEL, TAX, etc.)"),
    is_active: Optional[bool] = Query(None, description="Filter active or inactive policies"),
    department: Optional[str] = Query(None, description="Filter by department"),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_compliance_or_admin),
):
    """
    Retrieve all corporate compliance policies.
    Restricted to users with Compliance or Admin authorization.
    """
    seed_default_policies_if_empty(db, current_user)

    query = db.query(CompliancePolicy)

    if category:
        query = query.filter(CompliancePolicy.category.ilike(f"%{category}%"))
    if is_active is not None:
        query = query.filter(CompliancePolicy.is_active == is_active)
    if department and department.lower() != "all":
        query = query.filter(
            (CompliancePolicy.department == "All") | (CompliancePolicy.department.ilike(f"%{department}%"))
        )

    policies = query.order_by(CompliancePolicy.created_at.desc()).all()
    return {"total": len(policies), "policies": policies}


# ============================================================================
# 2. SYNC POLICIES TO VECTOR STORE
# ============================================================================
@router.post("/sync-vector-store")
def sync_policies_to_vector_store(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_compliance_or_admin),
):
    """
    Explicitly indexes all active compliance policies in PostgreSQL into the active Vector Store.
    """
    policies = db.query(CompliancePolicy).filter(CompliancePolicy.is_active == True).all()
    docs = [
        Document(
            page_content=(
                f"Corporate Compliance Policy [{p.policy_code}]: {p.title}\n"
                f"Category: {p.category} | Severity: {p.severity} | Department: {p.department or 'All'}\n"
                f"Rule Type: {p.rule_type} | Max Amount: {f'{p.max_amount:,.2f} {p.currency}' if p.max_amount is not None else 'N/A'}\n"
                f"Enforcement Standard & Criteria: {p.description}"
            ),
            metadata={
                "type": "compliance_policy",
                "policy_id": str(p.id),
                "policy_code": p.policy_code,
                "title": p.title,
                "category": p.category,
                "severity": p.severity,
                "rule_type": p.rule_type,
                "max_amount": float(p.max_amount) if p.max_amount is not None else None,
                "department": p.department or "All",
                "is_active": p.is_active,
            },
        )
        for p in policies
    ]

    if docs:
        vector_store_manager.add_documents(docs)

    return {
        "message": f"Successfully indexed {len(docs)} active compliance policies into Vector Store ({vector_store_manager.provider.upper()}).",
        "synced_count": len(docs),
    }


# ============================================================================
# 3. GET SINGLE POLICY DETAILS
# ============================================================================
@router.get("/{policy_id}", response_model=PolicyResponse)
def get_policy(
    policy_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_compliance_or_admin),
):
    """
    Retrieve specific compliance policy details by UUID.
    """
    policy = db.query(CompliancePolicy).filter(CompliancePolicy.id == policy_id).first()
    if not policy:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Compliance policy with ID {policy_id} not found.",
        )
    return policy


# ============================================================================
# 4. CREATE NEW POLICY
# ============================================================================
@router.post("", response_model=PolicyResponse, status_code=status.HTTP_201_CREATED)
def create_policy(
    policy_in: PolicyCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_compliance_or_admin),
):
    """
    Create a new compliance policy rule and index it into the Vector Store.
    """
    code = policy_in.policy_code
    if not code:
        code = f"POL-{policy_in.category[:3].upper()}-{uuid.uuid4().hex[:6].upper()}"

    existing = db.query(CompliancePolicy).filter(CompliancePolicy.policy_code == code).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"A policy with code '{code}' already exists.",
        )

    new_policy = CompliancePolicy(
        id=uuid.uuid4(),
        title=policy_in.title,
        policy_code=code,
        category=policy_in.category.upper(),
        description=policy_in.description,
        rule_type=policy_in.rule_type.upper(),
        max_amount=policy_in.max_amount,
        currency=policy_in.currency.upper(),
        severity=policy_in.severity.upper(),
        department=policy_in.department or "All",
        is_active=policy_in.is_active,
        created_by_id=current_user.id,
    )
    db.add(new_policy)
    db.commit()
    db.refresh(new_policy)

    # Automatically index the new policy into FAISS / Pinecone
    index_policy_in_vector_store(new_policy)

    return new_policy


# ============================================================================
# 5. UPDATE POLICY
# ============================================================================
@router.put("/{policy_id}", response_model=PolicyResponse)
def update_policy(
    policy_id: uuid.UUID,
    policy_in: PolicyUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_compliance_or_admin),
):
    """
    Update an existing compliance policy and refresh its vector index.
    """
    policy = db.query(CompliancePolicy).filter(CompliancePolicy.id == policy_id).first()
    if not policy:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Compliance policy with ID {policy_id} not found.",
        )

    update_data = policy_in.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        if value is not None:
            if isinstance(value, str) and field in ["category", "rule_type", "severity", "currency"]:
                value = value.upper()
            setattr(policy, field, value)

    policy.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(policy)

    # Refresh vector store document
    index_policy_in_vector_store(policy)

    return policy


# ============================================================================
# 6. TOGGLE POLICY ACTIVE STATUS
# ============================================================================
@router.patch("/{policy_id}/toggle", response_model=PolicyResponse)
def toggle_policy_status(
    policy_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_compliance_or_admin),
):
    """
    Toggle the active/inactive status of a compliance policy.
    """
    policy = db.query(CompliancePolicy).filter(CompliancePolicy.id == policy_id).first()
    if not policy:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Compliance policy with ID {policy_id} not found.",
        )

    policy.is_active = not policy.is_active
    policy.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(policy)

    index_policy_in_vector_store(policy)

    return policy


# ============================================================================
# 7. DELETE POLICY
# ============================================================================
@router.delete("/{policy_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_policy(
    policy_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_compliance_or_admin),
):
    """
    Delete a compliance policy from the corporate registry.
    """
    policy = db.query(CompliancePolicy).filter(CompliancePolicy.id == policy_id).first()
    if not policy:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Compliance policy with ID {policy_id} not found.",
        )

    db.delete(policy)
    db.commit()
    return None
