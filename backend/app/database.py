from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.config import settings
from app.models import Base

# Dynamically select active database based on ENVIRONMENT
SQLALCHEMY_DATABASE_URL = settings.active_database_url

masked_url = (
    SQLALCHEMY_DATABASE_URL.split("@")[-1]
    if "@" in SQLALCHEMY_DATABASE_URL
    else SQLALCHEMY_DATABASE_URL
)
print(f"[Database] Active Environment: '{settings.ENVIRONMENT.upper()}' | Connecting to: {masked_url}")

engine = create_engine(SQLALCHEMY_DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

from sqlalchemy import text

# Create all tables defined in app.models (users, invoices, line items, anomalies)
Base.metadata.create_all(bind=engine)


def run_column_migrations():
    """
    Safely ensures new columns exist on existing PostgreSQL tables without needing full alembic migration.
    """
    migration_statements = [
        # Invoices table additions
        "ALTER TABLE invoices ADD COLUMN IF NOT EXISTS subtotal NUMERIC(12, 2) DEFAULT 0.0;",
        "ALTER TABLE invoices ADD COLUMN IF NOT EXISTS tax_amount NUMERIC(12, 2) DEFAULT 0.0;",
        "ALTER TABLE invoices ADD COLUMN IF NOT EXISTS overall_confidence NUMERIC(5, 2) DEFAULT 0.95;",
        "ALTER TABLE invoices ADD COLUMN IF NOT EXISTS risk_level VARCHAR(50) DEFAULT 'LOW';",
        "ALTER TABLE invoices ADD COLUMN IF NOT EXISTS risk_score NUMERIC(5, 2) DEFAULT 0.05;",
        "ALTER TABLE invoices ADD COLUMN IF NOT EXISTS recommended_action TEXT;",
        "ALTER TABLE invoices ADD COLUMN IF NOT EXISTS ai_status VARCHAR(50) DEFAULT 'PENDING_REVIEW';",
        "ALTER TABLE invoices ADD COLUMN IF NOT EXISTS human_status VARCHAR(50) DEFAULT 'PENDING';",
        "ALTER TABLE invoices ADD COLUMN IF NOT EXISTS decision_notes TEXT;",
        "ALTER TABLE invoices ADD COLUMN IF NOT EXISTS decision_by_name VARCHAR(255);",
        "ALTER TABLE invoices ADD COLUMN IF NOT EXISTS decision_by_role VARCHAR(50);",
        "ALTER TABLE invoices ADD COLUMN IF NOT EXISTS decision_at TIMESTAMP;",
        # Backfill any nulls in existing rows
        "UPDATE invoices SET subtotal = total_amount WHERE subtotal IS NULL OR subtotal = 0.0;",
        "UPDATE invoices SET tax_amount = 0.0 WHERE tax_amount IS NULL;",
        "UPDATE invoices SET overall_confidence = 0.95 WHERE overall_confidence IS NULL;",
        "UPDATE invoices SET risk_level = 'LOW' WHERE risk_level IS NULL;",
        "UPDATE invoices SET risk_score = 0.05 WHERE risk_score IS NULL;",
        "UPDATE invoices SET ai_status = status WHERE ai_status IS NULL;",
        "UPDATE invoices SET human_status = 'APPROVED' WHERE status = 'APPROVED' AND (human_status IS NULL OR human_status = 'PENDING');",
        "UPDATE invoices SET human_status = 'REJECTED' WHERE status = 'REJECTED' AND (human_status IS NULL OR human_status = 'PENDING');",
        "UPDATE invoices SET human_status = 'PENDING' WHERE human_status IS NULL;",
        "UPDATE invoices SET recommended_action = 'Approve for standard processing and scheduled payment release.' WHERE recommended_action IS NULL AND status = 'APPROVED';",
        "UPDATE invoices SET recommended_action = 'Review AI findings and verify invoice against purchase order.' WHERE recommended_action IS NULL;",
        # AnomalyFindings table additions
        "ALTER TABLE anomaly_findings ADD COLUMN IF NOT EXISTS anomaly_flag VARCHAR(150);",
        "ALTER TABLE anomaly_findings ADD COLUMN IF NOT EXISTS reason TEXT;",
        # Backfill anomaly_flag and reason from anomaly_type and explanation if null
        "UPDATE anomaly_findings SET anomaly_flag = anomaly_type WHERE anomaly_flag IS NULL;",
        "UPDATE anomaly_findings SET reason = explanation WHERE reason IS NULL;",
    ]

    try:
        with engine.connect() as conn:
            for stmt in migration_statements:
                try:
                    conn.execute(text(stmt))
                except Exception as inner_err:
                    print(f"[Database Migration Warning] {stmt}: {inner_err}")
            conn.commit()
        print("[Database] Schema column verification & migrations executed successfully.")
    except Exception as err:
        print(f"[Database Migration Notice] Could not execute schema migrations automatically: {err}")


# Run migrations once on import
run_column_migrations()


# Dependency to get DB session
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()