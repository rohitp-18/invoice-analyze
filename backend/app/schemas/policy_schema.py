from datetime import datetime
from typing import Optional, List
import uuid
from pydantic import BaseModel, Field


class PolicyCreate(BaseModel):
    title: str = Field(..., description="Policy Title (e.g. Executive Meal Threshold)")
    policy_code: Optional[str] = Field(None, description="Optional custom policy code (e.g. POL-EXP-001)")
    category: str = Field(default="THRESHOLD", description="Category: THRESHOLD, TRAVEL, PROCUREMENT, TAX, GENERAL")
    description: str = Field(..., description="Detailed description of the compliance rule")
    rule_type: str = Field(default="MAX_AMOUNT", description="Rule type: MAX_AMOUNT, CATEGORY_RESTRICTION, VENDOR_RESTRICTION, MANDATORY_DOCUMENT")
    max_amount: Optional[float] = Field(default=None, description="Maximum amount allowed before violation")
    currency: Optional[str] = Field(default="USD", description="Currency standard")
    severity: str = Field(default="HIGH", description="Violation severity: LOW, MEDIUM, HIGH, CRITICAL")
    department: Optional[str] = Field(default="All", description="Applicable department or 'All'")
    is_active: bool = Field(default=True, description="Whether this policy is active")


class PolicyUpdate(BaseModel):
    title: Optional[str] = None
    category: Optional[str] = None
    description: Optional[str] = None
    rule_type: Optional[str] = None
    max_amount: Optional[float] = None
    currency: Optional[str] = None
    severity: Optional[str] = None
    department: Optional[str] = None
    is_active: Optional[bool] = None


class PolicyResponse(BaseModel):
    id: uuid.UUID
    title: str
    policy_code: str
    category: str
    description: str
    rule_type: str
    max_amount: Optional[float] = None
    currency: str
    severity: str
    department: Optional[str] = None
    is_active: bool
    created_by_id: Optional[uuid.UUID] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class PolicyListResponse(BaseModel):
    total: int
    policies: List[PolicyResponse]
