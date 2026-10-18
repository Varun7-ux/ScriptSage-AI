from fastapi import FastAPI

app = FastAPI(
    title="ScriptSage AI API",
    description="Backend API for the ScriptSage AI manuscript project.",
    version="0.1.0",
)


@app.get("/")
def root():
    return {
        "message": "ScriptSage AI backend is running!",
        "status": "success",
    }


@app.get("/health")
def health():
    return {"status": "healthy"}
