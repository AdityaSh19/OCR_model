from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from OCR_Module.api import OCR_router
import logging

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


app = FastAPI(title="RAG Document Bot API")

logger.info("FastAPI app initialized.")

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], 
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
logger.info("Attempting to include OCR_router...")
app.include_router(OCR_router, prefix="/rag_doc/OCR", tags=["OCR"])
logger.info("OCR_router included successfully.")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)