from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.database import get_db
from app.models import User
import app.schemas.user_schema as schemas
from app.authentication import get_current_user

router = APIRouter(prefix="/api/v1/admin", tags=["Admin Operations"])


# 1. GET ALL EMPLOYEES
@router.get("/employees", response_model=List[schemas.UserResponse], status_code=status.HTTP_200_OK)
def get_all_employees(
    department: Optional[str] = Query(None, description="Filter by department / team name"),
    role: Optional[str] = Query(None, description="Filter by role (e.g. EMPLOYEE, MANAGER, AUDITOR, ADMIN)"),
    search: Optional[str] = Query(None, description="Search by employee name or email"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Retrieve all employees/users with optional filtering by department, role, or keyword search.
    """
    query = db.query(User)

    if department:
        query = query.filter(func.lower(User.department) == department.lower().strip())
    if role:
        query = query.filter(func.lower(User.role) == role.lower().strip())
    if search:
        search_pattern = f"%{search.strip()}%"
        query = query.filter(
            (User.name.ilike(search_pattern)) | (User.email.ilike(search_pattern))
        )

    employees = query.order_by(User.name.asc()).all()
    return employees


# 2. GET ALL TEAMS / DEPARTMENTS
@router.get("/teams", response_model=List[schemas.TeamResponse], status_code=status.HTTP_200_OK)
def get_all_teams(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Retrieve a list of all distinct teams/departments along with member counts.
    """
    team_counts = (
        db.query(User.department, func.count(User.id).label("member_count"))
        .filter(User.department.isnot(None))
        .filter(User.department != "")
        .group_by(User.department)
        .order_by(User.department.asc())
        .all()
    )

    return [
        schemas.TeamResponse(team_name=dept, member_count=count)
        for dept, count in team_counts
    ]


# 3. GET ONE TEAM DETAILS
@router.get("/teams/{team_name}", response_model=schemas.TeamDetailResponse, status_code=status.HTTP_200_OK)
def get_one_team(
    team_name: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Retrieve summary details and member list for a single team/department.
    """
    members = (
        db.query(User)
        .filter(func.lower(User.department) == team_name.lower().strip())
        .order_by(User.name.asc())
        .all()
    )

    if not members:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Team '{team_name}' not found or has no members",
        )

    return schemas.TeamDetailResponse(
        team_name=team_name,
        member_count=len(members),
        members=members,
    )


# 4. GET TEAM MEMBERS
@router.get("/teams/{team_name}/members", response_model=List[schemas.UserResponse], status_code=status.HTTP_200_OK)
def get_team_members(
    team_name: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Retrieve all employees belonging to a specific team/department.
    """
    members = (
        db.query(User)
        .filter(func.lower(User.department) == team_name.lower().strip())
        .order_by(User.name.asc())
        .all()
    )

    if not members:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"No members found for team '{team_name}'",
        )

    return members
