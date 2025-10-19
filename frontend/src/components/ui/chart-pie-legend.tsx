"use client"
import { Pie, PieChart, Cell } from "recharts"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
} from "./chart"
import type { ChartConfig } from "./chart"

export const description = "A pie chart with a legend"

interface ChartPieLegendProps {
  data: Array<{
    name: string;
    value: number;
    fill: string;
  }>;
  config: ChartConfig;
  title?: string;
  description?: string;
  className?: string;
}

export function ChartPieLegend({ 
  data, 
  config, 
  title = "Pie Chart - Legend", 
  description,
  className
}: ChartPieLegendProps) {
  return (
    <Card className={`flex flex-col ${className || ''}`}>
      <CardHeader className="items-center pb-0">
        <CardTitle className="text-sm">{title}</CardTitle>
        {description && <CardDescription className="text-xs">{description}</CardDescription>}
      </CardHeader>
      <CardContent className="flex-1 pb-0">
        <ChartContainer
          config={config}
          className="mx-auto aspect-square max-h-[200px]"
        >
          <PieChart>
            <ChartTooltip
              cursor={false}
              content={<ChartTooltipContent hideLabel />}
            />
            <Pie 
              data={data} 
              dataKey="value" 
              nameKey="name"
              cx="50%" 
              cy="50%" 
              outerRadius={80}
            >
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.fill} />
              ))}
            </Pie>
            <ChartLegend
              content={<ChartLegendContent nameKey="name" />}
              className="-translate-y-2 flex-wrap gap-2 *:basis-1/4 *:justify-center"
            />
          </PieChart>
        </ChartContainer>
      </CardContent>
    </Card>
  )
}
