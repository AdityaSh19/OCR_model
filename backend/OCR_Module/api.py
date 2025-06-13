"""
OCR and Text Analysis API Router

This module provides optical character recognition (OCR) and text analysis 
services using Llama 3.2 Vision model through Together API.

Author: [Your Name]
Date: March 2025
"""

import json
import uuid
import logging
from fastapi import APIRouter, File, UploadFile
from fastapi.responses import StreamingResponse
from OCR_Module.OCR import process_single_image, cancel_api_requests

# Create router instead of app
OCR_router = APIRouter()
logging.info("OCR_router created in OCR_Module.api.")  # Add this line

# Dictionary to track active requests
active_requests = {}

@OCR_router.post("/upload/")
async def upload_images(files: list[UploadFile] = File(...)):
    # Generate unique request ID for this batch
    request_id = str(uuid.uuid4())
    active_requests[request_id] = {"cancelled": False}
    
    # Read all file contents immediately before starting processing
    file_data_list = []
    try:
        for file_upload_obj in files:
            filename = file_upload_obj.filename
            image_bytes = await file_upload_obj.read()
            file_data_list.append({"filename": filename, "image_bytes": image_bytes})
            # Close the file object after reading
            await file_upload_obj.close()
    except Exception as e:
        logging.error(f"Error reading uploaded files: {str(e)}", exc_info=True)
        # Return error response if we can't read the files
        error_response = {
            "status": "fatal_error",
            "data": {},
            "error": f"Failed to read uploaded files: {str(e)}"
        }
        return StreamingResponse(
            iter([f"data: {json.dumps(error_response, ensure_ascii=False)}\n\n"]),
            media_type="text/event-stream"
        )
    
    async def generate_results():
        try:
            # Send request ID as the first message
            initial_data = {
                "status": "started",
                "request_id": request_id,
                "data": {"total_files": len(file_data_list)},
                "error": None
            }
            yield f"data: {json.dumps(initial_data, ensure_ascii=False)}\n\n"
            
            total_files = len(file_data_list)
            processed_files = 0
            
            for file_data in file_data_list:
                try:
                    filename = file_data["filename"]
                    image_bytes = file_data["image_bytes"]

                    # Check if request was cancelled
                    if active_requests.get(request_id, {}).get("cancelled", False):
                        cancel_data = {
                            "status": "cancelled",
                            "data": {"filename": filename},
                            "error": "Processing cancelled by user"
                        }
                        yield f"data: {json.dumps(cancel_data, ensure_ascii=False)}\n\n"
                        continue
                    
                    # Process the image with request tracking, passing bytes and filename
                    result = await process_single_image(image_bytes, filename, request_id, active_requests)
                    
                    # Handle different result types
                    if isinstance(result, dict):
                        # Ensure proper structure
                        if "status" not in result:
                            result["status"] = "success"
                        yield f"data: {json.dumps(result, ensure_ascii=False)}\n\n"
                    else:
                        # Fallback for unexpected result types
                        error_data = {
                            "status": "error",
                            "data": {"filename": filename},
                            "error": "Unexpected response format"
                        }
                        yield f"data: {json.dumps(error_data, ensure_ascii=False)}\n\n"
                    
                    processed_files += 1
                    
                except Exception as e:
                    current_filename = file_data.get("filename", "unknown_file")
                    logging.error(f"Error processing image {current_filename}: {str(e)}", exc_info=True)
                    error_data = {
                        "status": "error",
                        "data": {"filename": current_filename},
                        "error": str(e)
                    }
                    yield f"data: {json.dumps(error_data, ensure_ascii=False)}\n\n"
            
            # Send completion signal
            completion_data = {
                "status": "completed",
                "data": {
                    "total_files": total_files,
                    "processed_files": processed_files
                },
                "error": None
            }
            yield f"data: {json.dumps(completion_data, ensure_ascii=False)}\n\n"
            
        except Exception as e:
            print(f"Fatal error in streaming: {str(e)}")
            fatal_error_data = {
                "status": "fatal_error",
                "data": {},
                "error": str(e)
            }
            yield f"data: {json.dumps(fatal_error_data, ensure_ascii=False)}\n\n"
        
        finally:
            # Clean up request tracking
            active_requests.pop(request_id, None)

    return StreamingResponse(
        generate_results(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Headers": "*"
        }
    )

@OCR_router.post("/cancel/{request_id}")
async def cancel_request(request_id: str):
    """Cancel an ongoing OCR processing request"""
    if request_id in active_requests:
        active_requests[request_id]["cancelled"] = True
        # Call the cancel function from OCR module
        cancel_api_requests(request_id)
        return {"status": "success", "message": f"Request {request_id} marked for cancellation"}
    else:
        return {"status": "error", "message": f"Request {request_id} not found or already completed"}