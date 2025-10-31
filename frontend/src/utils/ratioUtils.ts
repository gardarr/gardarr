/**
 * Ratio utilities
 *
 * Provides helpers to determine ratio grades and their corresponding colors.
 */

export function getRatioGrade(ratio: number): string {
  if (ratio >= 100) return "S++";
  if (ratio >= 50) return "S+";
  if (ratio >= 30) return "S";
  if (ratio >= 15) return "A";
  if (ratio >= 7) return "B";
  if (ratio >= 3) return "C";
  if (ratio >= 1) return "D";
  return "E";
}

export function getGradeColor(grade: string): string {
  switch (grade) {
    case "S++":
      return "bg-purple-100 text-purple-700 border-purple-200 dark:bg-purple-950 dark:text-purple-400 dark:border-purple-800";
    case "S+":
      return "bg-pink-100 text-pink-700 border-pink-200 dark:bg-pink-950 dark:text-pink-400 dark:border-pink-800";
    case "S":
      return "bg-yellow-100 text-yellow-700 border-yellow-200 dark:bg-yellow-950 dark:text-yellow-400 dark:border-yellow-800";
    case "A":
      return "bg-green-100 text-green-700 border-green-200 dark:bg-green-950 dark:text-green-400 dark:border-green-800";
    case "B":
      return "bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-950 dark:text-blue-400 dark:border-blue-800";
    case "C":
      return "bg-orange-100 text-orange-700 border-orange-200 dark:bg-orange-950 dark:text-orange-400 dark:border-orange-800";
    case "D":
      return "bg-red-100 text-red-700 border-red-200 dark:bg-red-950 dark:text-red-400 dark:border-red-800";
    case "E":
      return "bg-gray-100 text-gray-700 border-gray-200 dark:bg-gray-950 dark:text-gray-400 dark:border-gray-800";
    default:
      return "bg-muted text-muted-foreground border-border";
  }
}

import i18n from "@/i18n";

export function getGradeDescription(grade: string): string {
  switch (grade) {
    case "S++":
      return i18n.t("ratio.grades.description.Spp");
    case "S+":
      return i18n.t("ratio.grades.description.Sp");
    case "S":
      return i18n.t("ratio.grades.description.S");
    case "A":
      return i18n.t("ratio.grades.description.A");
    case "B":
      return i18n.t("ratio.grades.description.B");
    case "C":
      return i18n.t("ratio.grades.description.C");
    case "D":
      return i18n.t("ratio.grades.description.D");
    case "E":
      return i18n.t("ratio.grades.description.E");
    default:
      return i18n.t("ratio.grades.description.unknown");
  }
}

export function getGradeStars(grade: string): number {
  switch (grade) {
    case "S++":
      return 5;
    case "S+":
      return 4;
    case "S":
      return 4;
    case "A":
      return 3;
    case "B":
      return 2;
    case "C":
      return 1;
    case "D":
      return 1;
    case "E":
      return 0;
    default:
      return 0;
  }
}

export function getGradeGlowClass(grade: string): string {
  // Apply glow only for A or higher
  switch (grade) {
    case "S++":
      return "drop-shadow-[0_0_8px_rgba(168,85,247,0.6)]"; // purple-500
    case "S+":
      return "drop-shadow-[0_0_8px_rgba(236,72,153,0.6)]"; // pink-500
    case "S":
      return "drop-shadow-[0_0_8px_rgba(234,179,8,0.6)]"; // yellow-500
    case "A":
      return "drop-shadow-[0_0_6px_rgba(34,197,94,0.5)]"; // green-500
    default:
      return "";
  }
}

/**
 * Returns a motivational note for a given grade, encouraging positive sharing behavior.
 */
export function getGradeMessage(grade: string): string {
  switch (grade) {
    case "S++":
      return i18n.t("ratio.grades.message.Spp");
    case "S+":
      return i18n.t("ratio.grades.message.Sp");
    case "S":
      return i18n.t("ratio.grades.message.S");
    case "A":
      return i18n.t("ratio.grades.message.A");
    case "B":
      return i18n.t("ratio.grades.message.B");
    case "C":
      return i18n.t("ratio.grades.message.C");
    case "D":
      return i18n.t("ratio.grades.message.D");
    case "E":
      return i18n.t("ratio.grades.message.E");
    default:
      return i18n.t("ratio.grades.message.unknown");
  }
}