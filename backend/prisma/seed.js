const bcrypt = require('bcryptjs');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
  const adminPasswordHash = await bcrypt.hash('AdminPass!123', 10);
  const candidatePasswordHash = await bcrypt.hash('CandidatePass!123', 10);

  const admin = await prisma.user.upsert({
    where: { email: 'admin@example.com' },
    update: {
      name: 'Exam Admin',
      passwordHash: adminPasswordHash,
      role: 'ADMIN',
      isActive: true
    },
    create: {
      email: 'admin@example.com',
      name: 'Exam Admin',
      passwordHash: adminPasswordHash,
      role: 'ADMIN'
    }
  });

  const candidate = await prisma.user.upsert({
    where: { email: 'candidate@example.com' },
    update: {
      name: 'Candidate One',
      passwordHash: candidatePasswordHash,
      role: 'CANDIDATE',
      isActive: true
    },
    create: {
      email: 'candidate@example.com',
      name: 'Candidate One',
      passwordHash: candidatePasswordHash,
      role: 'CANDIDATE'
    }
  });

  const exam = await prisma.exam.create({
    data: {
      title: 'Sample Secure Exam',
      instructions: 'Read all instructions carefully. Keep both cameras active.',
      status: 'PUBLISHED',
      durationMinutes: 60,
      startsAt: new Date(Date.now() - 10 * 60 * 1000),
      endsAt: new Date(Date.now() + 5 * 60 * 60 * 1000),
      createdByUserId: admin.id,
      randomizeQuestions: true,
      questions: {
        create: [
          {
            type: 'MCQ',
            prompt: 'What is the time complexity of binary search?',
            optionsJson: {
              choices: [
                { id: 'opt_A', text: 'O(n)' },
                { id: 'opt_B', text: 'O(log n)' },
                { id: 'opt_C', text: 'O(n log n)' },
                { id: 'opt_D', text: 'O(1)' }
              ]
            },
            answerKeyJson: {
              correctOptionId: 'opt_B'
            },
            points: 2,
            orderIndex: 1
          },
          {
            type: 'CODING',
            prompt: 'Implement a function to reverse a linked list.',
            points: 5,
            orderIndex: 2
          },
          {
            type: 'SUBJECTIVE',
            prompt: 'Explain CAP theorem tradeoffs in distributed systems.',
            points: 3,
            orderIndex: 3
          }
        ]
      }
    }
  });

  await prisma.examAssignment.upsert({
    where: {
      examId_candidateId: {
        examId: exam.id,
        candidateId: candidate.id
      }
    },
    update: {},
    create: {
      examId: exam.id,
      candidateId: candidate.id
    }
  });

  console.log('Seed completed.');
  console.log('Admin: admin@example.com / AdminPass!123');
  console.log('Candidate: candidate@example.com / CandidatePass!123');
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
