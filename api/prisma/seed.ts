import { PrismaClient, Role, NotificationStatus, NotificationChannel, TicketPriority, TicketStatus, PaymentStatus, SubscriptionStatus } from "@prisma/client";
import bcrypt from "bcrypt";

const prisma = new PrismaClient();

const ensureAdminUser = async () => {
  const passwordHash = await bcrypt.hash("AdminPass123!", 10);
  const admin = await prisma.user.upsert({
    where: { email: "admin@nunya.com" },
    update: {
      full_name: "System Admin",
      password_hash: passwordHash,
      role: Role.ADMIN,
      is_active: true,
    },
    create: {
      full_name: "System Admin",
      email: "admin@nunya.com",
      password_hash: passwordHash,
      role: Role.ADMIN,
      is_active: true,
      is_premium: true,
    },
  });

  return admin;
};

const ensureGradeLevel = async (name: string, orderIndex: number) => {
  return prisma.gradeLevel.upsert({
    where: { name },
    update: {
      order_index: orderIndex,
      is_active: true,
    },
    create: {
      name,
      order_index: orderIndex,
      description: `${name} curriculum`,
    },
  });
};

const ensureSubject = async () => {
  const gradeLevel = await ensureGradeLevel("Grade 6", 6);

  const existing = await prisma.subject.findFirst({
    where: { subject_name: "Mathematics", grade_level: gradeLevel.name },
  });

  if (existing) {
    return existing;
  }

  return prisma.subject.create({
    data: {
      subject_name: "Mathematics",
      grade_level: gradeLevel.name,
      grade_level_id: gradeLevel.id,
      description: "Core numeracy fundamentals",
    },
  });
};

const ensureTopics = async (subjectId: number) => {
  const fractions =
    (await prisma.topic.findFirst({
      where: { subject_id: subjectId, topic_name: "Fractions" },
    })) ??
    (await prisma.topic.create({
      data: {
        subject_id: subjectId,
        topic_name: "Fractions",
        difficulty: "med",
      },
    }));

  const geometry =
    (await prisma.topic.findFirst({
      where: { subject_id: subjectId, topic_name: "Geometry Basics" },
    })) ??
    (await prisma.topic.create({
      data: {
        subject_id: subjectId,
        topic_name: "Geometry Basics",
        difficulty: "med",
      },
    }));

  return { fractions, geometry };
};

const ensureQuiz = async (
  topicId: number,
  question: string,
  answer: string,
  options: { a: string; b: string; c: string; d: string },
  xp = 10,
) => {
  const existing = await prisma.legacyQuiz.findFirst({
    where: { question_text: question },
  });

  if (existing) {
    return existing;
  }

  return prisma.legacyQuiz.create({
    data: {
      topic_id: topicId,
      question_text: question,
      option_a: options.a,
      option_b: options.b,
      option_c: options.c,
      option_d: options.d,
      correct_option: answer,
      difficulty: "med",
      xp_reward: xp,
      question_type: "multiple_choice",
      competency: "numeracy",
      is_premium: false,
    },
  });
};

const seedLegacyPracticeTest = async (subjectId: number, quizIds: number[]) => {
  const existing = await prisma.legacyPracticeTest.findFirst({
    where: { title: "Fractions Fundamentals" },
  });

  if (existing) {
    return;
  }

  const test = await prisma.legacyPracticeTest.create({
    data: {
      title: "Fractions Fundamentals",
      description: "Timed skill check that mixes fractions and geometry prompts.",
      subject_id: subjectId,
      difficulty: "med",
      xp_reward: 75,
      duration_minutes: 20,
      is_active: true,
    },
  });

  await prisma.legacyPracticeTestQuiz.createMany({
    data: quizIds.map((quizId, index) => ({
      practice_test_id: test.id,
      quiz_id: quizId,
      order_index: index,
    })),
  });
};

const seedRewards = async () => {
  const rewardCount = await prisma.reward.count();
  if (rewardCount > 0) {
    return;
  }

  await prisma.reward.createMany({
    data: [
      {
        title: "Welcome Pack",
        description: "Awarded to new learners after onboarding.",
        xp_value: 25,
      },
      {
        title: "Weekly Spotlight",
        description: "Manually granted bonus for outstanding participation.",
        xp_value: 75,
      },
    ],
  });
};

const seedNotifications = async (adminId: number) => {
  const count = await prisma.notification.count();
  if (count > 0) {
    return;
  }

  await prisma.notification.createMany({
    data: [
      {
        title: "Welcome to Nunyalearn",
        message: "Track XP, manage practice tests, and stay ahead with admin analytics.",
        status: NotificationStatus.sent,
        channel: NotificationChannel.app,
        audience: "all",
        published_at: new Date(),
        created_by: adminId,
      },
      {
        title: "Weekly Digest",
        message: "Engagement dipped 3% this week. Consider more challenges.",
        status: NotificationStatus.scheduled,
        channel: NotificationChannel.email,
        audience: "admins",
        scheduled_at: new Date(Date.now() + 24 * 60 * 60 * 1000),
        created_by: adminId,
      },
    ],
  });
};

const seedSupportTickets = async (adminId: number) => {
  const count = await prisma.supportTicket.count();
  if (count > 0) {
    return;
  }

  await prisma.supportTicket.create({
    data: {
      subject: "Cannot access premium quizzes",
      message: "My subscription shows active but quizzes are still locked.",
      status: TicketStatus.open,
      priority: TicketPriority.high,
      user_email: "learner1@example.com",
      assigned_to: adminId,
    },
  });

  await prisma.supportTicket.create({
    data: {
      subject: "Bug: streak counter not updating",
      message: "Streak remains at 1 even after daily attempts.",
      status: TicketStatus.pending,
      priority: TicketPriority.medium,
      user_email: "learner2@example.com",
    },
  });
};

const seedPaymentsAndSubscriptions = async () => {
  const paymentCount = await prisma.payment.count();
  if (paymentCount === 0) {
    await prisma.payment.createMany({
      data: [
        {
          user_email: "learner1@example.com",
          amount: 1299,
          currency: "USD",
          status: PaymentStatus.succeeded,
          method: "stripe",
          reference: "ch_learner1_001",
        },
        {
          user_email: "learner2@example.com",
          amount: 1299,
          currency: "USD",
          status: PaymentStatus.pending,
          method: "paypal",
          reference: "pp_learner2_001",
        },
      ],
    });
  }

  const subscriptionCount = await prisma.subscription.count();
  if (subscriptionCount === 0) {
    await prisma.subscription.createMany({
      data: [
        {
          user_email: "learner1@example.com",
          plan: "pro-monthly",
          status: SubscriptionStatus.active,
          renews_at: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
        },
        {
          user_email: "learner2@example.com",
          plan: "pro-monthly",
          status: SubscriptionStatus.past_due,
          renews_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        },
      ],
    });
  }
};

const seedPlatformSettings = async () => {
  await prisma.platformSetting.upsert({
    where: { id: 1 },
    update: {},
    create: {
      id: 1,
      default_role: Role.USER,
      onboarding_message: "Welcome aboard! Track XP and streaks to unlock achievements.",
      notifications_enabled: true,
      xp_multiplier: 1,
    },
  });
};

const main = async () => {
  const admin = await ensureAdminUser();
  const subject = await ensureSubject();
  const { fractions, geometry } = await ensureTopics(subject.id);

  const quizA = await ensureQuiz(fractions.id, "What is 1/2 + 1/4?", "B", {
    a: "1/2",
    b: "3/4",
    c: "1",
    d: "5/4",
  });
  const quizB = await ensureQuiz(fractions.id, "Simplify 3/5 + 2/5", "C", {
    a: "1/5",
    b: "3/5",
    c: "1",
    d: "6/5",
  });
  const quizC = await ensureQuiz(geometry.id, "How many degrees does a triangle have?", "C", {
    a: "90",
    b: "120",
    c: "180",
    d: "360",
  });

  await seedLegacyPracticeTest(subject.id, [quizA.id, quizB.id, quizC.id]);
  await seedRewards();
  await seedNotifications(admin.id);
  await seedSupportTickets(admin.id);
  await seedPaymentsAndSubscriptions();
  await seedPlatformSettings();

  console.log("✅ Seed data ensured for admin UX.");
};

main()
  .catch((error) => {
    console.error("❌ Seed failed:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
