/**
 * RatioBadge component
 * 
 * Displays a torrent's ratio with a minimalist grade badge.
 * Grades range from D (poor) to S (excellent) based on ratio thresholds.
 */

// Calculate grade based on ratio
function getRatioGrade(ratio: number): string {
    if (ratio >= 30) return "S";
    if (ratio >= 15) return "A";
    if (ratio >= 7) return "B";
    if (ratio >= 3) return "C";
    return "D";
  }
  
  // Get badge color based on grade (shadcn minimalist style)
  function getGradeColor(grade: string): string {
    switch (grade) {
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
      default:
        return "bg-muted text-muted-foreground border-border";
    }
  }
  
  // Get grade description
  function getGradeDescription(grade: string): string {
    switch (grade) {
      case "S": return "MUITO BOM!";
      case "A": return "BOM";
      case "B": return "REGULAR";
      case "C": return "RUIM";
      case "D": return "MUITO RUIM";
      default: return "DESCONHECIDO";
    }
  }
  
  export function RatioBadge({ ratio }: { ratio: number }) {
    const grade = getRatioGrade(ratio);
    const colorClass = getGradeColor(grade);
    
    return (
      <div className="flex items-center gap-2">
        <span 
          className={`inline-flex items-center justify-center min-w-[28px] px-2 py-0.5 rounded-md text-xs font-medium border ${colorClass}`}
          title={`Ratio: ${ratio.toFixed(2)} - Nota: ${grade} (${getGradeDescription(grade)})`}
        >
          {grade}
        </span>
        <span className="text-xs text-muted-foreground font-mono tabular-nums">
          {ratio.toFixed(1)}
        </span>
      </div>
    );
  }
  