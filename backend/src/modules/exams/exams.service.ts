import { QuestionType } from "@prisma/client";
import { prisma } from "../../db/prisma";

type CreateExamInput = {
  title: string;
  instructions: string;
  durationMinutes: number;
  startsAt: string;
  endsAt: string;
  randomizeQuestions: boolean;
  questions: Array<{
    type: QuestionType;
    prompt: string;
    optionsJson?: unknown;
    answerKeyJson?: unknown;
    points: number;
  }>;
};

export const examsService = {
  async getAssigned(candidateId: string) {
    const assignments = await prisma.examAssignment.findMany({
      where: {
        candidateId,
        exam: {
          status: "PUBLISHED"
        }
      },
      include: {
        exam: true
      },
      orderBy: {
        exam: {
          startsAt: "asc"
        }
      }
    });

    return assignments.map((assignment) => assignment.exam);
  },

  async createExam(actorId: string, input: CreateExamInput) {
    return prisma.exam.create({
      data: {
        title: input.title,
        instructions: input.instructions,
        durationMinutes: input.durationMinutes,
        startsAt: new Date(input.startsAt),
        endsAt: new Date(input.endsAt),
        randomizeQuestions: input.randomizeQuestions,
        createdByUserId: actorId,
        status: "PUBLISHED",
        questions: {
          createMany: {
            data: input.questions.map((question, idx) => ({
              type: question.type,
              prompt: question.prompt,
              optionsJson: question.optionsJson as object | undefined,
              answerKeyJson: question.answerKeyJson as object | undefined,
              points: question.points,
              orderIndex: idx
            }))
          }
        }
      },
      include: {
        questions: true
      }
    });
  },

  async getExamForCandidate(examId: string, candidateId: string) {
    const assignment = await prisma.examAssignment.findFirst({
      where: {
        examId,
        candidateId
      },
      include: {
        exam: {
          include: {
            questions: {
              orderBy: { orderIndex: "asc" }
            }
          }
        }
      }
    });

    if (!assignment) {
      throw new Error("Exam not assigned");
    }

    const exam = assignment.exam;
    const now = Date.now();
    if (exam.startsAt.getTime() > now || exam.endsAt.getTime() < now) {
      throw new Error("Exam is not available at this time");
    }

    const questions = exam.randomizeQuestions
      ? [...exam.questions].sort(() => Math.random() - 0.5)
      : exam.questions;

    return {
      ...exam,
      questions: questions.map((question) => ({
        id: question.id,
        type: question.type,
        prompt: question.prompt,
        optionsJson: question.optionsJson,
        points: question.points
      }))
    };
  }
};
