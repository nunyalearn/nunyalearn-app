"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type GradeOption = {
  id: number;
  name?: string;
};

type SubjectOption = {
  id: number;
  subject_name?: string;
  name?: string;
};

type TopicOption = {
  id: number;
  label: string;
};

type CurriculumFilterProps = {
  gradeValue: string;
  subjectValue: string;
  topicValue: string;
  onGradeChange: (value: string) => void;
  onSubjectChange: (value: string) => void;
  onTopicChange: (value: string) => void;
  gradeOptions: GradeOption[];
  subjectOptions: SubjectOption[];
  topicOptions: TopicOption[];
  allGradeValue: string;
  allSubjectValue: string;
  allTopicValue: string;
  topicsLoading?: boolean;
};

const CurriculumFilter = ({
  gradeValue,
  subjectValue,
  topicValue,
  onGradeChange,
  onSubjectChange,
  onTopicChange,
  gradeOptions,
  subjectOptions,
  topicOptions,
  allGradeValue,
  allSubjectValue,
  allTopicValue,
  topicsLoading = false,
}: CurriculumFilterProps) => {
  const subjectDisabled = gradeValue === allGradeValue;
  const topicDisabled = subjectValue === allSubjectValue;

  const subjectPlaceholder = subjectDisabled ? "Select a grade first" : "All subjects";
  const topicPlaceholder = topicDisabled
    ? "Select a subject first"
    : topicsLoading
      ? "Loading..."
      : "All topics";

  return (
    <>
      <div className="space-y-1">
        <label className="text-sm text-muted-foreground">Grade</label>
        <Select value={gradeValue} onValueChange={onGradeChange}>
          <SelectTrigger>
            <SelectValue placeholder="All grades" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={allGradeValue}>All grades</SelectItem>
            {gradeOptions.map((grade) => (
              <SelectItem key={grade.id} value={String(grade.id)}>
                {grade.name ?? `Grade ${grade.id}`}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1">
        <label className="text-sm text-muted-foreground">Subject</label>
        <Select value={subjectValue} onValueChange={onSubjectChange} disabled={subjectDisabled}>
          <SelectTrigger>
            <SelectValue placeholder={subjectPlaceholder} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={allSubjectValue}>All subjects</SelectItem>
            {subjectOptions.map((subject) => (
              <SelectItem key={subject.id} value={String(subject.id)}>
                {subject.subject_name ?? subject.name ?? `Subject ${subject.id}`}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1">
        <label className="text-sm text-muted-foreground">Topic</label>
        <Select value={topicValue} onValueChange={onTopicChange} disabled={topicDisabled}>
          <SelectTrigger>
            <SelectValue placeholder={topicPlaceholder} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={allTopicValue}>All topics</SelectItem>
            {topicOptions.map((topic) => (
              <SelectItem key={topic.id} value={String(topic.id)}>
                {topic.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </>
  );
};

export default CurriculumFilter;
