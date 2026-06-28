from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .db_asyncpg import close_pool, get_pool
from .routers import fill, health, prompts, recommend, search, signals, stats


@asynccontextmanager
async def lifespan(app: FastAPI):
    await get_pool()
    yield
    await close_pool()


app = FastAPI(
    title="Acervo API",
    description="Catálogo de prompts de la organización",
    version="0.1.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health.router)
app.include_router(prompts.router)
app.include_router(search.router)
app.include_router(recommend.router)
app.include_router(fill.router)
app.include_router(signals.router)
app.include_router(stats.router)
