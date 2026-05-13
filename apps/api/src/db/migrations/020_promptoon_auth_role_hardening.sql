CREATE INDEX IF NOT EXISTS idx_promptoon_session_user_expires
  ON promptoon_session(user_id, expires_at DESC);

CREATE INDEX IF NOT EXISTS idx_promptoon_session_active
  ON promptoon_session(id, user_id, expires_at);

INSERT INTO promptoon_project_member (project_id, user_id, role)
SELECT project.id, project.created_by, 'owner'
FROM promptoon_project AS project
WHERE NOT EXISTS (
  SELECT 1
  FROM promptoon_project_member AS member
  WHERE member.project_id = project.id
    AND member.user_id = project.created_by
);
