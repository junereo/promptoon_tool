UPDATE promptoon_project AS project
SET status = 'published',
    updated_at = NOW()
WHERE project.status <> 'archived'
  AND EXISTS (
    SELECT 1
    FROM promptoon_movingtoon_episode AS movingtoon
    WHERE movingtoon.project_id = project.id
      AND movingtoon.publish_status = 'published'
  );
