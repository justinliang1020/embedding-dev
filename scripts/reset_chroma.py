import chromadb
from chromadb.config import Settings

chroma_client = chromadb.Client(
    Settings(
        chroma_api_impl="rest",
        chroma_server_host="localhost",
        chroma_server_http_port="8000",
    )
)

chroma_client.reset()