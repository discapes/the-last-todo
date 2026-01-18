// ============================================================================
// MOCK DATA - Keep this up to date when adding new features!
// Demonstrates: classes, normal todos, recurring tasks, dates/times, notes,
// completion states, background color states (overdue/today/future),
// and section sorting (expired, due today, other, not yet actionable, done)
// ============================================================================

export type TodoClass = { id: number; name: string; color: string };

export type Todo = {
	id: number;
	text: string;
	done: boolean;
	completedAt: string | null;
	classId: number | null;
	notes: string;
	startDate: string;
	startTime: string;
	endDate: string;
	endTime: string;
};

export type RecurringTask = {
	id: number;
	text: string;
	classId: number | null;
	notes: string;
	startDate: string; // first instance start
	startTime: string;
	endDate: string; // first instance due
	endTime: string;
	repeatCount: number; // how many weeks
	completedWeeks: Record<number, true>; // e.g., { 1: true, 3: true }
};

export function getMockData(): {
	classes: TodoClass[];
	todos: Todo[];
	recurringTasks: RecurringTask[];
} {
	const today = new Date();
	const formatDate = (d: Date) => d.toISOString().split('T')[0];

	const yesterday = new Date(today);
	yesterday.setDate(today.getDate() - 1);

	const twoDaysAgo = new Date(today);
	twoDaysAgo.setDate(today.getDate() - 2);

	const tomorrow = new Date(today);
	tomorrow.setDate(today.getDate() + 1);

	const nextWeek = new Date(today);
	nextWeek.setDate(today.getDate() + 7);

	const twoWeeksAgo = new Date(today);
	twoWeeksAgo.setDate(today.getDate() - 14);

	const classes: TodoClass[] = [
		{ id: 1, name: 'Work', color: '#3b82f6' },
		{ id: 2, name: 'Personal', color: '#10b981' },
		{ id: 3, name: 'Urgent', color: '#ef4444' },
		{ id: 4, name: 'Learning', color: '#8b5cf6' }
	];

	const todos: Todo[] = [
		{
			id: 101,
			text: 'Submit quarterly report',
			done: false,
			completedAt: null,
			classId: 1,
			notes: 'Need to include sales figures and projections for Q2.',
			startDate: formatDate(twoDaysAgo),
			startTime: '09:00',
			endDate: formatDate(yesterday),
			endTime: '17:00'
		},
		{
			id: 102,
			text: 'Call dentist for appointment',
			done: false,
			completedAt: null,
			classId: 2,
			notes: '',
			startDate: '',
			startTime: '',
			endDate: formatDate(today),
			endTime: '12:00'
		},
		{
			id: 103,
			text: 'Prepare presentation slides',
			done: false,
			completedAt: null,
			classId: 1,
			notes: 'Use the new company template. Include demo video.',
			startDate: formatDate(today),
			startTime: '10:00',
			endDate: formatDate(nextWeek),
			endTime: '09:00'
		},
		{
			id: 104,
			text: 'Review pull request #42',
			done: true,
			completedAt: formatDate(today),
			classId: 1,
			notes: 'Looks good, minor formatting suggestions.',
			startDate: '',
			startTime: '',
			endDate: formatDate(tomorrow),
			endTime: ''
		},
		{
			id: 105,
			text: 'Pay electricity bill',
			done: true,
			completedAt: formatDate(yesterday),
			classId: 2,
			notes: 'Set up autopay to avoid this in future.',
			startDate: '',
			startTime: '',
			endDate: formatDate(twoDaysAgo),
			endTime: ''
		},
		{
			id: 106,
			text: 'Organize desk',
			done: true,
			completedAt: formatDate(today),
			classId: 2,
			notes: '',
			startDate: '',
			startTime: '',
			endDate: '',
			endTime: ''
		},
		{
			id: 107,
			text: 'Read "Clean Code" chapter 5',
			done: false,
			completedAt: null,
			classId: 4,
			notes: 'Focus on the section about function arguments.',
			startDate: '',
			startTime: '',
			endDate: '',
			endTime: ''
		},
		{
			id: 108,
			text: 'Fix production bug',
			done: false,
			completedAt: null,
			classId: 3,
			notes: 'Users reporting 500 errors on checkout page.',
			startDate: formatDate(today),
			startTime: '08:00',
			endDate: formatDate(today),
			endTime: '18:00'
		},
		{
			id: 109,
			text: 'Prepare for annual review',
			done: false,
			completedAt: null,
			classId: 1,
			notes: 'Gather performance metrics and accomplishments.',
			startDate: formatDate(nextWeek),
			startTime: '',
			endDate: formatDate(new Date(nextWeek.getTime() + 7 * 24 * 60 * 60 * 1000)),
			endTime: '17:00'
		}
	];

	const recurringTasks: RecurringTask[] = [
		{
			id: 200,
			text: 'Team standup meeting',
			classId: 1,
			notes: 'Daily sync with the team on sprint progress.',
			startDate: formatDate(twoWeeksAgo),
			startTime: '09:30',
			endDate: formatDate(twoWeeksAgo),
			endTime: '10:00',
			repeatCount: 4,
			completedWeeks: { 1: true, 2: true }
		},
		{
			id: 201,
			text: 'Weekly review',
			classId: 2,
			notes: 'Review goals and plan for next week.',
			startDate: formatDate(new Date(twoWeeksAgo.getTime() + 4 * 24 * 60 * 60 * 1000)), // Friday two weeks ago
			startTime: '16:00',
			endDate: formatDate(new Date(twoWeeksAgo.getTime() + 4 * 24 * 60 * 60 * 1000)),
			endTime: '17:00',
			repeatCount: 6,
			completedWeeks: { 1: true }
		}
	];

	return { classes, todos, recurringTasks };
}
