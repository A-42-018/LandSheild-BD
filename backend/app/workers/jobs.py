"""Job runner (D6): a thin interface so FastAPI BackgroundTasks can be swapped out later."""
from collections.abc import Callable
from typing import Any, Protocol

from fastapi import BackgroundTasks


class JobRunner(Protocol):
    def submit(self, fn: Callable[..., Any], *args: Any, **kwargs: Any) -> None: ...


class BackgroundTasksRunner:
    """Runs jobs after the response is sent (FastAPI BackgroundTasks)."""

    def __init__(self, tasks: BackgroundTasks) -> None:
        self._tasks = tasks

    def submit(self, fn: Callable[..., Any], *args: Any, **kwargs: Any) -> None:
        self._tasks.add_task(fn, *args, **kwargs)


class InlineRunner:
    """Runs the job immediately in the caller (scripts, tests)."""

    def submit(self, fn: Callable[..., Any], *args: Any, **kwargs: Any) -> None:
        fn(*args, **kwargs)
