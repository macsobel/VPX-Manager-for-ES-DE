import logging
from typing import Any, Dict, Optional

from pydantic import BaseModel

logger = logging.getLogger(__name__)


class TaskProgress(BaseModel):
    id: str
    status: str = "idle"  # idle, running, completed, failed
    message: str = ""
    current: int = 0
    total: int = 0
    start_time: float = 0
    end_time: float = 0
    error: Optional[str] = None
    extra_data: Dict[str, Any] = {}

    @property
    def percentage(self) -> int:
        if self.total <= 0:
            return 0
        return int((self.current / self.total) * 100)


class TaskRegistry:
    """Singleton registry for tracking long-running background tasks."""

    _instance = None
    _tasks: Dict[str, TaskProgress] = {}

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super(TaskRegistry, cls).__new__(cls)
        return cls._instance

    def get_task(self, task_id: str) -> TaskProgress:
        if task_id not in self._tasks:
            self._tasks[task_id] = TaskProgress(id=task_id)
        return self._tasks[task_id]

    def start_task(
        self, task_id: str, total: int = 0, message: str = "Starting task..."
    ):
        import time

        task = self.get_task(task_id)
        task.status = "running"
        task.total = total
        task.current = 0
        task.message = message
        task.start_time = time.time()
        task.error = None
        logger.info(f"Task started: {task_id} (total: {total})")

    def update_progress(
        self, task_id: str, current: int, message: Optional[str] = None
    ):
        task = self.get_task(task_id)
        task.current = current
        if message:
            task.message = message

    def complete_task(self, task_id: str, message: str = "Completed", extra_data: Optional[Dict[str, Any]] = None):
        import time

        task = self.get_task(task_id)
        task.status = "completed"
        task.message = message
        task.end_time = time.time()
        if extra_data:
            task.extra_data = extra_data
        logger.info(f"Task completed: {task_id}")

    def fail_task(self, task_id: str, error: str):
        import time

        task = self.get_task(task_id)
        task.status = "failed"
        task.error = error
        task.message = f"Error: {error}"
        task.end_time = time.time()
        logger.error(f"Task failed: {task_id} - {error}")

    def get_all_statuses(self) -> Dict[str, Any]:
        results = {}
        for k, v in self._tasks.items():
            data = v.model_dump()
            # Flatten extra_data for frontend compatibility if needed, 
            # or just let the frontend access .extra_data
            if v.extra_data:
                data.update(v.extra_data)
            results[k] = data
        return results


task_registry = TaskRegistry()
