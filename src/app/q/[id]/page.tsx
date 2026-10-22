import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { QuestionView } from "@/components/QuestionView";
import { getQuestion, isQuestionId, QUESTIONS, questionNumber } from "@/lib/questions";

export async function generateMetadata({ params }: PageProps<"/q/[id]">): Promise<Metadata> {
  const { id } = await params;
  if (!isQuestionId(id)) return {};
  return {
    title: `Question ${questionNumber(id)} of ${QUESTIONS.length}: ${getQuestion(id).title}`,
  };
}

export default async function QuestionPage({ params, searchParams }: PageProps<"/q/[id]">) {
  const { id } = await params;
  if (!isQuestionId(id)) notFound();
  const { from } = await searchParams;
  return <QuestionView key={id} id={id} fromReview={from === "review"} />;
}
