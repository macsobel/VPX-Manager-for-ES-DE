"""
Collections API router.
"""

from typing import List, Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

import backend.core.database as db
from backend.services.esde_sync_service import esde_sync

router = APIRouter(prefix="/api/collections", tags=["collections"])


class CollectionCreate(BaseModel):
    name: str
    description: str = ""
    filter_rules: dict = {}


class CollectionUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    filter_rules: Optional[dict] = None


class TableIds(BaseModel):
    table_ids: List[int]


@router.get("")
async def list_collections():
    collections = await db.get_collections()
    return {"collections": collections}


@router.post("")
async def create_collection(data: CollectionCreate):
    collection_id = await db.create_collection(
        name=data.name,
        description=data.description,
        filter_rules=data.filter_rules,
    )
    # Background sync to ES-DE
    await esde_sync.export_to_esde(collection_id)
    return {"id": collection_id, "name": data.name}


@router.get("/{collection_id}")
async def get_collection(collection_id: int):
    collection = await db.get_collection(collection_id)
    if not collection:
        raise HTTPException(status_code=404, detail="Collection not found")
    # Also return the tables in this collection
    tables = await db.get_tables(collection_id=collection_id, limit=500)
    collection["tables"] = tables
    return collection


@router.put("/{collection_id}")
async def update_collection(collection_id: int, data: CollectionUpdate):
    existing = await db.get_collection(collection_id)
    if not existing:
        raise HTTPException(status_code=404, detail="Collection not found")

    await db.update_collection(
        collection_id,
        name=data.name,
        description=data.description,
        filter_rules=data.filter_rules,
    )
    # Background sync to ES-DE
    await esde_sync.export_to_esde(collection_id)
    return await db.get_collection(collection_id)


@router.delete("/{collection_id}")
async def delete_collection(collection_id: int):
    existing = await db.get_collection(collection_id)
    if not existing:
        raise HTTPException(status_code=404, detail="Collection not found")
    await db.delete_collection(collection_id)
    # Remove from ES-DE
    await esde_sync.delete_from_esde(existing["name"])
    return {"success": True, "message": f"Deleted collection '{existing['name']}'"}


@router.post("/{collection_id}/tables")
async def add_tables(collection_id: int, data: TableIds):
    existing = await db.get_collection(collection_id)
    if not existing:
        raise HTTPException(status_code=404, detail="Collection not found")

    added = 0
    for table_id in data.table_ids:
        if await db.add_table_to_collection(collection_id, table_id):
            added += 1

    # Sync changes to ES-DE
    if added > 0:
        await esde_sync.export_to_esde(collection_id)

    return {"added": added, "collection_id": collection_id}


@router.delete("/{collection_id}/tables/{table_id}")
async def remove_table(collection_id: int, table_id: int):
    result = await db.remove_table_from_collection(collection_id, table_id)
    if not result:
        raise HTTPException(status_code=404, detail="Table not in collection")
    
    # Sync changes to ES-DE
    await esde_sync.export_to_esde(collection_id)
    
    return {"success": True}


@router.post("/sync")
async def manual_sync():
    """Trigger a full bi-directional sync with ES-DE."""
    await esde_sync.sync_all()
    return {"success": True, "message": "Bi-directional sync with ES-DE complete"}
