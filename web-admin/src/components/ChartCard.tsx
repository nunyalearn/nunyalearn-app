import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type ChartCardProps = {
  title: string;
  description?: string;
  children: React.ReactNode;
};

const ChartCard = ({ title, description, children }: ChartCardProps) => (
  <Card className="h-full">
    <CardHeader>
      <CardTitle className="text-lg">{title}</CardTitle>
      {description ? <p className="text-sm text-muted-foreground">{description}</p> : null}
    </CardHeader>
    <CardContent className="h-[320px]">{children}</CardContent>
  </Card>
);

export default ChartCard;
