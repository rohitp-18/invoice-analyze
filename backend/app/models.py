from datetime import date, datetime
from typing import List, Optional
import uuid

from sqlalchemy import String, Numeric, Date, DateTime, ForeignKey, Text
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship
from sqlalchemy.sql import func


class Base(DeclarativeBase):
    """Base class for SQLAlchemy declarative models."""
    pass


class User(Base):
    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False, index=True)
    department: Mapped[Optional[str]] = mapped_column(String(100)) # e.g., Finance, procurement, admin, compliance
    role: Mapped[str] = mapped_column(String(50), default="EMPLOYEE") # e.g., EMPLOYEE, MANAGER, AUDITOR, admin
    created_at: Mapped[datetime] = mapped_column(DateTime, default=func.now(), server_default=func.now())
    hashed_password: Mapped[str] = mapped_column(String(255), nullable=False)  # Store hashed passwords

    # Relationships
    submitted_invoices: Mapped[List["Invoice"]] = relationship(
        back_populates="submitter",
        foreign_keys="Invoice.submitter_id",
        cascade="all, delete-orphan"
    )
    approved_invoices: Mapped[List["Invoice"]] = relationship(
        back_populates="approver",
        foreign_keys="Invoice.approver_id"
    )


class Invoice(Base):
    __tablename__ = "invoices"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    submitter_id: Mapped[Optional[uuid.UUID]] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"))
    approver_id: Mapped[Optional[uuid.UUID]] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"))
    
    invoice_number: Mapped[str] = mapped_column(String(100), nullable=False)
    vendor_name: Mapped[str] = mapped_column(String(255), nullable=False)
    invoice_date: Mapped[date] = mapped_column(Date, nullable=False)
    total_amount: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False)
    currency: Mapped[str] = mapped_column(String(10), default="USD", server_default="USD")
    status: Mapped[str] = mapped_column(String(50), default="PENDING_REVIEW", server_default="PENDING_REVIEW")
    document_url: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=func.now(), server_default=func.now())

    # Relationships
    submitter: Mapped[Optional["User"]] = relationship(
        back_populates="submitted_invoices",
        foreign_keys=[submitter_id]
    )
    approver: Mapped[Optional["User"]] = relationship(
        back_populates="approved_invoices",
        foreign_keys=[approver_id]
    )
    line_items: Mapped[List["InvoiceLineItem"]] = relationship(
        back_populates="invoice", cascade="all, delete-orphan"
    )
    anomalies: Mapped[List["AnomalyFinding"]] = relationship(
        back_populates="invoice", cascade="all, delete-orphan"
    )


class InvoiceLineItem(Base):
    __tablename__ = "invoice_line_items"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    invoice_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("invoices.id", ondelete="CASCADE"))
    description: Mapped[str] = mapped_column(Text, nullable=False)
    quantity: Mapped[float] = mapped_column(Numeric(10, 2), default=1.0)
    unit_price: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False)
    total_amount: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False)
    category: Mapped[Optional[str]] = mapped_column(String(100))

    # Relationships
    invoice: Mapped["Invoice"] = relationship(back_populates="line_items")


class AnomalyFinding(Base):
    __tablename__ = "anomaly_findings"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    invoice_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("invoices.id", ondelete="CASCADE"))
    anomaly_type: Mapped[str] = mapped_column(String(50), nullable=False)
    severity: Mapped[str] = mapped_column(String(20), nullable=False)
    explanation: Mapped[str] = mapped_column(Text, nullable=False)
    evidence: Mapped[Optional[str]] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=func.now(), server_default=func.now())

    # Relationships
    invoice: Mapped["Invoice"] = relationship(back_populates="anomalies")