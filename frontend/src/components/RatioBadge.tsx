/**
 * RatioBadge component
 * 
 * Displays a torrent's ratio with a minimalist grade badge.
 * Grades range from E (poor) to S (excellent) based on ratio thresholds.
 */

import { getRatioGrade, getGradeColor, getGradeDescription } from "@/utils/ratioUtils";
  
  export function RatioBadge({ ratio, showValue = true }: { ratio: number; showValue?: boolean }) {
    const grade = getRatioGrade(ratio);
    const colorClass = getGradeColor(grade);
    
    return (
      <div className="flex items-center gap-2">
        <span 
          className={`inline-flex items-center justify-center min-w-[28px] px-2 py-0.5 rounded-md text-xs font-medium border ${colorClass}`}
          title={`Ratio: ${ratio.toFixed(2)} - Nota: ${grade} (${getGradeDescription(grade)})`}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 20 20"
            fill="currentColor"
            aria-hidden="true"
            className="w-3 h-3 mr-1"
          >
            <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.802 2.036a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.539 1.118l-2.802-2.036a1 1 0 00-1.176 0l-2.802 2.036c-.783.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.88 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
          </svg>
          {grade}
        </span>
        {showValue && (
          <span className="text-xs text-muted-foreground font-mono tabular-nums">
            {ratio.toFixed(1)}
          </span>
        )}
      </div>
    );
  }
  

