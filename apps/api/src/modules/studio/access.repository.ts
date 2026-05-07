import type { ProjectMemberSummary, ProjectRole, StudioRole } from '@promptoon/shared';

import type { DbExecutor } from '../../db';

interface ProjectMemberRow {
  project_id: string;
  user_id: string;
  login_id: string;
  role: ProjectRole;
  created_at: Date;
}

function toIsoString(value: Date): string {
  return value.toISOString();
}

function mapProjectMember(row: ProjectMemberRow): ProjectMemberSummary {
  return {
    projectId: row.project_id,
    userId: row.user_id,
    loginId: row.login_id,
    role: row.role,
    createdAt: toIsoString(row.created_at)
  };
}

export async function getStudioMemberRole(db: DbExecutor, userId: string): Promise<StudioRole | null> {
  const result = await db.query<{ role: StudioRole }>('SELECT role FROM promptoon_studio_member WHERE user_id = $1', [userId]);
  return result.rows[0]?.role ?? null;
}

export async function getProjectOwnerId(db: DbExecutor, projectId: string): Promise<string | null> {
  const result = await db.query<{ created_by: string }>('SELECT created_by FROM promptoon_project WHERE id = $1', [projectId]);
  return result.rows[0]?.created_by ?? null;
}

export async function getProjectMemberRole(db: DbExecutor, input: { projectId: string; userId: string }): Promise<ProjectRole | null> {
  const result = await db.query<{ role: ProjectRole }>(
    'SELECT role FROM promptoon_project_member WHERE project_id = $1 AND user_id = $2',
    [input.projectId, input.userId]
  );

  return result.rows[0]?.role ?? null;
}

export async function upsertProjectMember(
  db: DbExecutor,
  input: {
    projectId: string;
    userId: string;
    role: ProjectRole;
  }
): Promise<void> {
  await db.query(
    `INSERT INTO promptoon_project_member (project_id, user_id, role)
     VALUES ($1, $2, $3)
     ON CONFLICT (project_id, user_id) DO UPDATE
       SET role = EXCLUDED.role`,
    [input.projectId, input.userId, input.role]
  );
}

export async function listProjectMembers(db: DbExecutor, projectId: string): Promise<ProjectMemberSummary[]> {
  const result = await db.query<ProjectMemberRow>(
    `SELECT
       member.project_id,
       member.user_id,
       users.login_id,
       member.role,
       member.created_at
     FROM promptoon_project_member AS member
     INNER JOIN users ON users.id = member.user_id
     WHERE member.project_id = $1
     ORDER BY
       CASE member.role
         WHEN 'owner' THEN 0
         WHEN 'producer' THEN 1
         WHEN 'writer' THEN 2
         ELSE 3
       END,
       users.login_id ASC`,
    [projectId]
  );

  return result.rows.map(mapProjectMember);
}

export async function getUserIdByLoginId(db: DbExecutor, loginId: string): Promise<string | null> {
  const result = await db.query<{ id: string }>('SELECT id FROM users WHERE login_id = $1', [loginId]);
  return result.rows[0]?.id ?? null;
}

export async function deleteProjectMember(db: DbExecutor, input: { projectId: string; userId: string }): Promise<boolean> {
  const result = await db.query('DELETE FROM promptoon_project_member WHERE project_id = $1 AND user_id = $2', [
    input.projectId,
    input.userId
  ]);

  return (result.rowCount ?? 0) > 0;
}

export async function getEpisodeProjectId(db: DbExecutor, episodeId: string): Promise<string | null> {
  const result = await db.query<{ project_id: string }>('SELECT project_id FROM promptoon_episode WHERE id = $1', [episodeId]);
  return result.rows[0]?.project_id ?? null;
}

export async function getMovingtoonEpisodeProjectId(db: DbExecutor, episodeId: string): Promise<string | null> {
  const result = await db.query<{ project_id: string }>('SELECT project_id FROM promptoon_movingtoon_episode WHERE id = $1', [episodeId]);
  return result.rows[0]?.project_id ?? null;
}

export async function getCutProjectId(db: DbExecutor, cutId: string): Promise<string | null> {
  const result = await db.query<{ project_id: string }>(
    `SELECT episode.project_id
     FROM promptoon_cut AS cut
     INNER JOIN promptoon_episode AS episode ON episode.id = cut.episode_id
     WHERE cut.id = $1`,
    [cutId]
  );

  return result.rows[0]?.project_id ?? null;
}

export async function getChoiceProjectId(db: DbExecutor, choiceId: string): Promise<string | null> {
  const result = await db.query<{ project_id: string }>(
    `SELECT episode.project_id
     FROM promptoon_choice AS choice
     INNER JOIN promptoon_cut AS cut ON cut.id = choice.cut_id
     INNER JOIN promptoon_episode AS episode ON episode.id = cut.episode_id
     WHERE choice.id = $1`,
    [choiceId]
  );

  return result.rows[0]?.project_id ?? null;
}
