"""
OCR Processing Module - Modified for better cancellation support

Contains functions for processing images through OCR, text analysis,
and word cloud generation.
"""

from dotenv import load_dotenv

# Load environment variables
load_dotenv()

import base64
import io
import os
import re
import logging
from PIL import Image, ImageEnhance
from wordcloud import WordCloud
from together import Together
from openai import OpenAI

# Global client variables
together_client = None
openrouter_client = None

# Configure logger for this module
logger = logging.getLogger(__name__)
logger.setLevel(logging.INFO) # Ensure logger level is set if not configured globally

def get_together_client():
    """Initialize Together client with proper error handling"""
    global together_client
    if together_client is None:
        logger.info("Initializing Together client...")
        api_key = os.getenv('TOGETHER_API_KEY')
        if not api_key:
            logger.error("TOGETHER_API_KEY environment variable is not set.")
            raise ValueError("TOGETHER_API_KEY environment variable is not set")
        logger.info("TOGETHER_API_KEY found. Attempting to create Together client.")
        try:
            together_client = Together(api_key=api_key)
            logger.info("Together client initialized successfully.")
        except Exception as e:
            logger.error(f"Failed to initialize Together client: {e}")
            raise
    return together_client

def get_openrouter_client():
    """Initialize OpenRouter client with proper error handling"""
    global openrouter_client
    if openrouter_client is None:
        logger.info("Initializing OpenRouter client...")
        api_key = os.getenv('OpenRouter_API_KEY')
        if not api_key:
            logger.error("OpenRouter_API_KEY environment variable is not set.")
            raise ValueError("OpenRouter_API_KEY environment variable is not set")
        logger.info("OpenRouter_API_KEY found. Attempting to create OpenRouter client.")
        try:
            openrouter_client = OpenAI(
                base_url="https://openrouter.ai/api/v1",
                api_key=api_key,
            )
            logger.info("OpenRouter client initialized successfully.")
        except Exception as e:
            logger.error(f"Failed to initialize OpenRouter client: {e}")
            raise
    return openrouter_client

# Dictionary to store active API calls by request ID
active_api_calls = {}

def cancel_api_requests(request_id):
    """Cancel any API calls associated with a specific request ID"""
    if request_id in active_api_calls:
        print(f"Cancelling API calls for request {request_id}")
        # API doesn't directly support cancellation, but we can mark as cancelled
        active_api_calls[request_id]["cancelled"] = True
        active_api_calls.pop(request_id, None)

async def process_single_image(image_bytes: bytes, filename: str, request_id=None, active_requests=None):
    """Process a single image through OCR pipeline with cancellation support"""
    logger.info(f"Image data received for: {filename} with request_id: {request_id}")
    
    # Initialize request tracking if not already in dictionary
    if request_id and request_id not in active_api_calls:
        active_api_calls[request_id] = {"cancelled": False}
    
    try:
        # Check if request is already cancelled before proceeding
        if request_id and active_requests and active_requests.get(request_id, {}).get("cancelled", False):
            logger.info(f"Request {request_id} was cancelled. Skipping processing for {filename}.")
            return {
                "status": "cancelled",
                "data": {"filename": filename},
                "error": "Processing cancelled"
            }
            
        # Process image
        temp_upload_dir = os.getenv('TEMP_UPLOAD_DIR', 'temp_uploads')
        os.makedirs(temp_upload_dir, exist_ok=True)
        
        temp_path = os.path.join(temp_upload_dir, f"temp_{filename}")
        with open(temp_path, "wb") as f:
            f.write(image_bytes)
        
        with Image.open(temp_path) as img:
            if img.mode not in ('L', 'RGB'):
                img = img.convert('RGB')
            
            # Resize large images to reduce token consumption
            max_width = int(os.getenv('MAX_IMAGE_WIDTH', 1200))
            max_height = int(os.getenv('MAX_IMAGE_HEIGHT', 1200))
            if img.width > max_width or img.height > max_height:
                img.thumbnail((max_width, max_height), Image.LANCZOS)
                logger.info(f"Resized image to {img.width}x{img.height}")
            
            enhancer = ImageEnhance.Contrast(img)
            enhanced_img = enhancer.enhance(2.0)
            bw_img = enhanced_img.convert("L")
            target_dpi = (72, 72)
            bw_img.save(temp_path, dpi=target_dpi, quality=85)
        
        with open(temp_path, "rb") as f:
            encoded_image = base64.b64encode(f.read()).decode('utf-8')
        
        os.remove(temp_path)

        # Check for cancellation before OCR API call
        if request_id and active_requests and active_requests.get(request_id, {}).get("cancelled", False):
            logger.info(f"Request {request_id} was cancelled before OCR for {filename}. Stopping.")
            return {
                "status": "cancelled",
                "data": {"filename": filename},
                "error": "Processing cancelled"
            }

        # OCR Request with OpenRouter API
        ocr_model = os.getenv('OpenRouter_OCR_MODEL', 'google/gemma-3-12b-it:free')
        logger.info(f"Using OpenRouter OCR model: {ocr_model} for {filename}")
        client = get_openrouter_client()
        logger.info(f"Attempting OCR API call for {filename} with request_id: {request_id}")
        completion = client.chat.completions.create(
            extra_headers={
                "HTTP-Referer": os.getenv('OPENROUTER_SITE_URL', 'http://localhost:5173'),
                "X-Title": os.getenv('OPENROUTER_SITE_NAME', 'OCR Application'),
            },
            model=ocr_model,
            messages=[
                {
                    "role": "user",
                    "content": [
                        {
                            "type": "text",
                            "text": "Analyze the image and extract all the text from the image in a very precise manner. If the text is in tabular format, put it in a table format. Use bullet points and other punctuations/styling wherever required. No extra explanations or greetings/salutations are required.\n7. MAINTAIN:\n - Tabular format of the table data using pipes (|)\n - Original text in its native script (Hindi, Marathi, or any other language)"
                        },
                        {
                            "type": "image_url",
                            "image_url": {
                                "url": f"data:image/jpeg;base64,{encoded_image}"
                            }
                        }
                    ]
                }
            ],
            temperature=0,
            max_tokens=4096
        )
        
        ocr_result = completion.choices[0].message.content
        logger.info(f"OCR Generated for {filename}")

        # Check for cancellation before summary API call
        if request_id and active_requests and active_requests.get(request_id, {}).get("cancelled", False):
            logger.info(f"Request {request_id} was cancelled before summary for {filename}. Stopping.")
            return {
                "status": "cancelled",
                "data": {"filename": filename},
                "error": "Processing cancelled"
            }

        summary_model = os.getenv('SUMMARY_MODEL', 'meta-llama/Llama-3.3-70B-Instruct-Turbo-Freee')
        logger.info(f"Using Summary model: {summary_model} for {filename}")
        # Summary and Grammar Request
        together_client_instance = get_together_client() # Renamed to avoid conflict
        logger.info(f"Attempting Summary API call for {filename} with request_id: {request_id}")
        summary_completion = together_client_instance.chat.completions.create(
            model=summary_model,
            messages=[
                {
                    "role": "user",
                    "content": f"You are a helpful assistant. Perform two tasks on the provided content and output only within the specified tags:\
                        <summary>Please provide a concise and brief third person perspective summary of the following text. No meta commentary before or after summary is required. Make sure always return summary in English</summary> and \
                        <grammar>Provide grammatical corrections for the text. If no corrections are needed, respond with 'None found.'</grammar>\n\n{ocr_result}"
                }
            ],
            temperature=0.1,
            max_tokens=4096,
            stream=False
        )
        
        summary_result = summary_completion.choices[0].message.content
        logger.info(f"Summary Generated for {filename}")

        # Check for final cancellation
        if request_id and active_requests and active_requests.get(request_id, {}).get("cancelled", False):
            logger.info(f"Request {request_id} was cancelled. Discarding results for {filename}.")
            return {
                "status": "cancelled",
                "data": {"filename": filename},
                "error": "Processing cancelled"
            }

        # Generate word cloud based on script detection
        wordcloud_base64 = generate_wordcloud(ocr_result)
        logger.info(f"Word Cloud generated for {filename}")

        # Extract structured information from the LLM response
        summary_match = re.search(r'<summary>(.*?)</summary>', summary_result, re.DOTALL)
        grammar_match = re.search(r'<grammar>(.*?)</grammar>', summary_result, re.DOTALL)

        # Clean up tracking for this request
        if request_id and request_id in active_api_calls:
            active_api_calls.pop(request_id, None)

        # Prepare final response
        return {
            "status": "success",
            "data": {
                "filename": filename,
                "img_base64": encoded_image,
                "OCR": ocr_result,
                "Summary": summary_match.group(1).strip() if summary_match else "No summary available",
                "Grammar": grammar_match.group(1).strip() if grammar_match else "No grammar corrections",
                "word_cloud": wordcloud_base64
            },
            "error": None
        }
    except Exception as e:
        logger.error(f"Error processing image {filename}: {str(e)}", exc_info=True)
        # Clean up tracking on error
        if request_id and request_id in active_api_calls:
            active_api_calls.pop(request_id, None)
        return {
            "status": "error",
            "data": {"filename": filename},
            "error": str(e)
        }

def get_script_regex():
    """Get regex pattern for matching text in multiple scripts"""
    script_ranges = {
        'Devanagari': r'[\u0900-\u097F]+',
        'Latin': r'[a-zA-ZÀ-ÿçÇáéíóúàèìòùâêîôûãõüñ]+',
        'Arabic': r'[\u0600-\u06FF]+',
        'Bengali': r'[\u0980-\u09FF]+',
        'Gurmukhi': r'[\u0A00-\u0A7F]+',
        'Gujarati': r'[\u0A80-\u0AFF]+',
        'Tamil': r'[\u0B80-\u0BFF]+',
        'Telugu': r'[\u0C00-\u0C7F]+',
        'Kannada': r'[\u0C80-\u0CFF]+',
        'Malayalam': r'[\u0D00-\u0D7F]+',
        'Thai': r'[\u0E00-\u0E7F]+'
    }
    return '|'.join(script_ranges.values())

def generate_wordcloud(text):
    """Generate word cloud from text with appropriate font selection"""
    try:
        logger.info("Attempting to generate word cloud.")
        # Check if the text contains Thai script characters
        has_thai = any('\u0E00' <= c <= '\u0E7F' for c in text)
        
        # Select font based on detected script
        font_file = "NotoSansThai-VariableFont_wdth,wght.ttf" if has_thai else "NotoSans-VariableFont_wdth,wght.ttf"
        
        # Get the directory where this OCR.py file is located
        current_dir = os.path.dirname(os.path.abspath(__file__))
        font_path = os.path.join(current_dir, "fonts", font_file)
        
        # Check if font file exists, otherwise use None (system default)
        if not os.path.exists(font_path):
            logger.warning(f"Font file not found: {font_path}. Using system default font.")
            font_path = None

        # Generate word cloud
        wordcloud = WordCloud(
            width=800, 
            height=400, 
            background_color='white',
            font_path=font_path,
            regexp=get_script_regex() if font_path else None,
            collocations=False,
            normalize_plurals=False
        ).generate(text)
        
        # Convert to base64 for web display
        img_buffer = io.BytesIO()
        wordcloud.to_image().save(img_buffer, format='PNG')
        logger.info("Word cloud generated successfully.")
        return base64.b64encode(img_buffer.getvalue()).decode()
    
    except Exception as e:
        logger.error(f"Error generating word cloud: {str(e)}", exc_info=True)
        # Return a simple placeholder if word cloud generation fails
        try:
            # Create a simple text-based image as fallback
            from PIL import Image, ImageDraw, ImageFont
            img = Image.new('RGB', (800, 400), color='white')
            draw = ImageDraw.Draw(img)
            
            # Use default font
            try:
                font = ImageFont.load_default()
            except:
                font = None
            
            # Draw simple text
            draw.text((50, 180), "Word Cloud Generation Failed", fill='black', font=font)
            
            img_buffer = io.BytesIO()
            img.save(img_buffer, format='PNG')
            return base64.b64encode(img_buffer.getvalue()).decode()
        except:
            # If all else fails, return empty string
            return ""