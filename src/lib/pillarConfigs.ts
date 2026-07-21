import type { PillarConfig } from "./pillarBackup";

/**
 * Backup/restore configs for each content pillar. Order of tables matters:
 * parents must come before children so restore upserts can satisfy FKs.
 */

export const SUPPLEMENTS_PILLAR: PillarConfig = {
  key: "supplements",
  label: "Supplements",
  tables: [
    { name: "supplement_categories", orderBy: "sort_order" },
    { name: "supplement_conditions" },
    { name: "supplement_master" },
    { name: "supplement_condition_rules" },
    { name: "supplement_badges" },
  ],
};

export const FASTING_PILLAR: PillarConfig = {
  key: "fasting",
  label: "Fasting",
  tables: [
    { name: "fasting_protocols" },
    // fasting_badges has a self-referential parent_badge_id; single upsert
    // batch (default 500) handles typical library sizes in one transaction.
    { name: "fasting_badges" },
    { name: "fasting_stage_milestones" },
    { name: "fasting_weekly_plans" },
  ],
};

export const EXERCISE_PILLAR: PillarConfig = {
  key: "exercise",
  label: "Exercise",
  tables: [
    { name: "exercise_categories", orderBy: "sort_order" },
    { name: "exercises", orderBy: "sort_order", imageColumns: ["image_url"] },
    { name: "exercise_badges", orderBy: "sort_order" },
  ],
};

// Stress & Yoga live in the shared videos tables. video_thumbnails uses
// video_id (text) as its PK; video_metadata uses id (uuid) but has a unique
// video_id column too.
export const YOGA_STRESS_PILLAR: PillarConfig = {
  key: "yoga-stress",
  label: "Stress & Yoga",
  tables: [
    { name: "video_categories" },
    { name: "videos", imageColumns: ["thumbnail_url"] },
    { name: "video_thumbnails", onConflict: "video_id", imageColumns: ["thumbnail_url"] },
    { name: "video_metadata", imageColumns: ["thumbnail_url"] },
  ],
};
