"""مهام خلفية عامة."""

import logging

logger = logging.getLogger(__name__)


def revalidate_model(model_name: str) -> bool:
    """يبطل تخزين Next.js المؤقت للوسوم المرتبطة بنموذج."""
    from apps.core.revalidate import MODEL_TAGS, revalidate

    tags = MODEL_TAGS.get(model_name)
    if not tags:
        return False
    return revalidate(tags)
