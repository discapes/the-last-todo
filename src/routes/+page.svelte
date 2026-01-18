<script lang="ts">
	import './layout.css';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Checkbox } from '$lib/components/ui/checkbox';
	import { Badge } from '$lib/components/ui/badge';
	import { Textarea } from '$lib/components/ui/textarea';
	import { Label } from '$lib/components/ui/label';
	import * as Card from '$lib/components/ui/card';
	import X from '@lucide/svelte/icons/x';
	import NotebookPen from '@lucide/svelte/icons/notebook-pen';
	import ChevronDown from '@lucide/svelte/icons/chevron-down';
	import ChevronRight from '@lucide/svelte/icons/chevron-right';
	import Repeat from '@lucide/svelte/icons/repeat';
	import { confetti } from '@neoconfetti/svelte';
	import { flip } from 'svelte/animate';
	import { send, receive } from './transition';
	import { getMockData, type Todo, type TodoClass, type RecurringTask } from './mock-data';
	import { browser } from '$app/environment';

	const STORAGE_KEY = 'todo-app-data';

	function getToday(): string {
		const d = new Date();
		return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
	}

	function getCurrentTime(): string {
		const d = new Date();
		return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
	}

	type StoredData = ReturnType<typeof getMockData>;

	function loadFromStorage(): StoredData {
		if (!browser) return getMockData();
		const stored = localStorage.getItem(STORAGE_KEY);
		if (stored) {
			try {
				const data = JSON.parse(stored);
				// Handle migration from old format (without recurringTasks)
				if (!data.recurringTasks) {
					data.recurringTasks = [];
				}
				return data;
			} catch {
				return getMockData();
			}
		}
		return getMockData();
	}

	const initialData = loadFromStorage();
	let classes = $state<TodoClass[]>(initialData.classes);
	let todos = $state<Todo[]>(initialData.todos);
	let recurringTasks = $state<RecurringTask[]>(initialData.recurringTasks);

	$effect(() => {
		if (browser) {
			localStorage.setItem(STORAGE_KEY, JSON.stringify({ classes, todos, recurringTasks }));
		}
	});

	// Form state for new todo
	let newTodo = $state('');
	let selectedClassId = $state<number | null>(null);
	let newStartDate = $state(getToday());
	let newStartTime = $state(getCurrentTime());
	let newEndDate = $state('');
	let newEndTime = $state('');
	let repeatCount = $state(1);

	let newClassName = $state('');
	let newClassColor = $state('#3b82f6');

	let expandedTodoId = $state<string | null>(null);
	let collapsedSections = $state<Set<string>>(new Set());
	let showConfetti = $state(false);

	// Unified view item type
	type ViewItem = {
		id: string; // unique identifier for the view
		text: string;
		done: boolean;
		classId: number | null;
		notes: string;
		startDate: string;
		startTime: string;
		endDate: string;
		endTime: string;
		isRecurringInstance: boolean;
		recurringTaskId?: number;
		weekNumber?: number;
		// For regular todos, reference to actual todo
		todoRef?: Todo;
	};

	function addClass() {
		if (!newClassName.trim()) return;
		classes.push({ id: Date.now(), name: newClassName.trim(), color: newClassColor });
		newClassName = '';
		newClassColor = '#3b82f6';
	}

	function removeClass(id: number) {
		const cls = classes.find((c) => c.id === id);
		if (!confirm(`Delete class "${cls?.name}"? Todos using this class will become unclassified.`))
			return;
		classes = classes.filter((c) => c.id !== id);
		todos = todos.map((t) => (t.classId === id ? { ...t, classId: null } : t));
		recurringTasks = recurringTasks.map((t) => (t.classId === id ? { ...t, classId: null } : t));
	}

	function addDays(dateStr: string, days: number): string {
		if (!dateStr) return '';
		const date = new Date(dateStr + 'T00:00:00');
		date.setDate(date.getDate() + days);
		return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
	}

	function addTodo() {
		if (!newTodo.trim()) return;

		if (repeatCount > 1) {
			// Create recurring task
			recurringTasks.push({
				id: Date.now(),
				text: newTodo.trim(),
				classId: selectedClassId,
				notes: '',
				startDate: newStartDate,
				startTime: newStartTime,
				endDate: newEndDate,
				endTime: newEndTime,
				repeatCount: repeatCount,
				completedWeeks: {}
			});
		} else {
			// Create regular todo
			todos.push({
				id: Date.now(),
				text: newTodo.trim(),
				done: false,
				completedAt: null,
				classId: selectedClassId,
				notes: '',
				startDate: newStartDate,
				startTime: newStartTime,
				endDate: newEndDate,
				endTime: newEndTime
			});
		}

		newTodo = '';
		newStartDate = getToday();
		newStartTime = getCurrentTime();
		newEndDate = '';
		newEndTime = '';
		repeatCount = 1;
	}

	function removeRecurringTask(id: number) {
		if (!confirm('Delete this recurring task and all its instances?')) return;
		recurringTasks = recurringTasks.filter((t) => t.id !== id);
	}

	function toggleRecurringWeek(taskId: number, weekNumber: number) {
		const task = recurringTasks.find((t) => t.id === taskId);
		if (!task) return;

		if (task.completedWeeks[weekNumber]) {
			delete task.completedWeeks[weekNumber];
		} else {
			task.completedWeeks[weekNumber] = true;
		}
		// Trigger reactivity
		recurringTasks = [...recurringTasks];
	}

	function toggleDone(item: ViewItem) {
		if (item.done) {
			// Unchecking - no confetti
			if (item.isRecurringInstance && item.recurringTaskId && item.weekNumber) {
				toggleRecurringWeek(item.recurringTaskId, item.weekNumber);
			} else if (item.todoRef) {
				item.todoRef.done = false;
				item.todoRef.completedAt = null;
			}
		} else {
			// Marking as done - show confetti
			if (item.isRecurringInstance && item.recurringTaskId && item.weekNumber) {
				toggleRecurringWeek(item.recurringTaskId, item.weekNumber);
			} else if (item.todoRef) {
				item.todoRef.done = true;
				item.todoRef.completedAt = getToday();
			}
			showConfetti = false;
			requestAnimationFrame(() => (showConfetti = true));
		}
	}

	function removeTodo(id: number) {
		todos = todos.filter((t) => t.id !== id);
	}

	function getClass(classId: number | null) {
		return classes.find((c) => c.id === classId);
	}

	function toggleNotes(id: string) {
		expandedTodoId = expandedTodoId === id ? null : id;
	}

	function clearAllData() {
		if (!confirm('Clear all data? This will delete all todos, recurring tasks, and classes.'))
			return;
		classes = [];
		todos = [];
		recurringTasks = [];
	}

	function resetToMockData() {
		if (!confirm('Reset to mock data? This will replace all current data.')) return;
		const data = getMockData();
		classes = data.classes;
		todos = data.todos;
		recurringTasks = data.recurringTasks;
	}

	function getDataAsJson(): string {
		return JSON.stringify({ classes, todos, recurringTasks }, null, 2);
	}

	function loadDataFromJson(json: string): boolean {
		try {
			const data = JSON.parse(json);
			if (!data.classes || !data.todos) {
				alert('Invalid data format: missing classes or todos');
				return false;
			}
			classes = data.classes;
			todos = data.todos;
			recurringTasks = data.recurringTasks || [];
			return true;
		} catch {
			alert('Invalid JSON format');
			return false;
		}
	}

	async function copyToClipboard() {
		await navigator.clipboard.writeText(getDataAsJson());
		alert('Data copied to clipboard');
	}

	function downloadAsJson() {
		const blob = new Blob([getDataAsJson()], { type: 'application/json' });
		const url = URL.createObjectURL(blob);
		const a = document.createElement('a');
		a.href = url;
		a.download = `todos-${getToday()}.json`;
		a.click();
		URL.revokeObjectURL(url);
	}

	async function pasteFromClipboard() {
		const text = await navigator.clipboard.readText();
		if (loadDataFromJson(text)) {
			alert('Data loaded from clipboard');
		}
	}

	function uploadFromFile() {
		const input = document.createElement('input');
		input.type = 'file';
		input.accept = '.json';
		input.onchange = async (e) => {
			const file = (e.target as HTMLInputElement).files?.[0];
			if (!file) return;
			const text = await file.text();
			if (loadDataFromJson(text)) {
				alert('Data loaded from file');
			}
		};
		input.click();
	}

	function toggleSection(section: string) {
		if (collapsedSections.has(section)) {
			collapsedSections.delete(section);
		} else {
			collapsedSections.add(section);
		}
		collapsedSections = new Set(collapsedSections);
	}

	function formatDateTime(dateStr: string, timeStr: string): string {
		if (!dateStr) return '';
		const dateTimeStr = timeStr ? `${dateStr}T${timeStr}` : `${dateStr}T00:00:00`;
		const date = new Date(dateTimeStr);
		if (timeStr) {
			return date.toLocaleString(undefined, {
				month: 'short',
				day: 'numeric',
				hour: 'numeric',
				minute: '2-digit'
			});
		}
		return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
	}

	// Generate view items from todos and recurring tasks
	let allViewItems = $derived.by(() => {
		const items: ViewItem[] = [];

		// Add regular todos
		for (const todo of todos) {
			items.push({
				id: `todo-${todo.id}`,
				text: todo.text,
				done: todo.done,
				classId: todo.classId,
				notes: todo.notes,
				startDate: todo.startDate,
				startTime: todo.startTime,
				endDate: todo.endDate,
				endTime: todo.endTime,
				isRecurringInstance: false,
				todoRef: todo
			});
		}

		// Generate instances from recurring tasks
		for (const task of recurringTasks) {
			for (let week = 1; week <= task.repeatCount; week++) {
				const offset = (week - 1) * 7;
				items.push({
					id: `recurring-${task.id}-week-${week}`,
					text: task.text,
					done: !!task.completedWeeks[week],
					classId: task.classId,
					notes: task.notes,
					startDate: addDays(task.startDate, offset),
					startTime: task.startTime,
					endDate: addDays(task.endDate, offset),
					endTime: task.endTime,
					isRecurringInstance: true,
					recurringTaskId: task.id,
					weekNumber: week
				});
			}
		}

		return items;
	});

	// Compare date+time against current moment
	// Returns: -1 if in past, 0 if current (today with no time, or within same minute), 1 if in future
	function compareDateTimeToNow(date: string, time: string): number {
		if (!date) return 0;
		const today = getToday();

		if (date < today) return -1;
		if (date > today) return 1;

		// Date is today - check time if specified
		if (!time) return 0; // No time means "anytime today" = current

		const currentTime = getCurrentTime();
		if (time < currentTime) return -1;
		if (time > currentTime) return 1;
		return 0;
	}

	function isExpired(item: ViewItem): boolean {
		if (!item.endDate) return false;
		return compareDateTimeToNow(item.endDate, item.endTime) < 0;
	}

	function isDueToday(item: ViewItem): boolean {
		if (!item.endDate) return false;
		return item.endDate === getToday() && compareDateTimeToNow(item.endDate, item.endTime) >= 0;
	}

	function isNotYetActionable(item: ViewItem): boolean {
		if (!item.startDate) return false;
		return compareDateTimeToNow(item.startDate, item.startTime) > 0;
	}

	function getItemBackgroundClass(item: ViewItem): string {
		if (!item.endDate) return '';

		const desaturate = item.done || isNotYetActionable(item);

		if (isDueToday(item)) {
			return desaturate ? 'bg-yellow-50' : 'bg-yellow-100';
		} else if (isExpired(item)) {
			return desaturate ? 'bg-red-50' : 'bg-red-100';
		} else {
			return desaturate ? 'bg-green-50' : 'bg-green-100';
		}
	}

	function sortByDueDate(a: ViewItem, b: ViewItem): number {
		if (a.endDate && b.endDate) {
			if (a.endDate !== b.endDate) return a.endDate.localeCompare(b.endDate);
			if (a.endTime && b.endTime) return a.endTime.localeCompare(b.endTime);
			if (a.endTime) return -1;
			if (b.endTime) return 1;
		}
		if (a.endDate) return -1;
		if (b.endDate) return 1;
		return 0;
	}

	function sortByStartDate(a: ViewItem, b: ViewItem): number {
		if (a.startDate && b.startDate) {
			if (a.startDate !== b.startDate) return a.startDate.localeCompare(b.startDate);
			if (a.startTime && b.startTime) return a.startTime.localeCompare(b.startTime);
		}
		if (a.startDate) return -1;
		if (b.startDate) return 1;
		return 0;
	}

	let expiredItems = $derived(
		allViewItems.filter((t) => !t.done && isExpired(t)).sort(sortByDueDate)
	);

	let dueTodayItems = $derived(
		allViewItems.filter((t) => !t.done && isDueToday(t)).sort(sortByDueDate)
	);

	let activeItems = $derived(
		allViewItems
			.filter((t) => {
				if (t.done) return false;
				if (isExpired(t)) return false;
				if (isDueToday(t)) return false;
				if (isNotYetActionable(t)) return false;
				return true;
			})
			.sort(sortByDueDate)
	);

	let notYetActionableItems = $derived(
		allViewItems.filter((t) => !t.done && isNotYetActionable(t)).sort(sortByStartDate)
	);

	let doneItems = $derived(allViewItems.filter((t) => t.done).sort((a, b) => sortByDueDate(b, a)));

	type SectionConfig = {
		key: string;
		items: ViewItem[];
		label: string;
		badgeClass: string;
	};

	let sections = $derived<SectionConfig[]>([
		{
			key: 'expired',
			items: expiredItems,
			label: 'EXPIRED',
			badgeClass: 'bg-red-200 text-red-900 hover:bg-red-200'
		},
		{
			key: 'dueToday',
			items: dueTodayItems,
			label: 'DUE TODAY',
			badgeClass: 'bg-yellow-200 text-yellow-900 hover:bg-yellow-200'
		},
		{
			key: 'active',
			items: activeItems,
			label: 'ACTIVE',
			badgeClass: 'bg-secondary text-secondary-foreground hover:bg-secondary/80'
		},
		{
			key: 'notYetActionable',
			items: notYetActionableItems,
			label: 'NOT YET ACTIONABLE',
			badgeClass: 'bg-blue-100 text-blue-900 hover:bg-blue-100'
		},
		{
			key: 'done',
			items: doneItems,
			label: 'DONE',
			badgeClass:
				'border border-input bg-background text-muted-foreground hover:bg-accent hover:text-accent-foreground'
		}
	]);
</script>

{#if showConfetti}
	<div
		class="pointer-events-none fixed top-0 left-1/2 z-50"
		use:confetti={{
			particleCount: 100,
			force: 0.6,
			stageWidth: window.innerWidth,
			stageHeight: window.innerHeight
		}}
	></div>
{/if}

<div class="mx-auto max-w-7xl p-6">
	<div class="flex flex-col gap-6 xl:flex-row xl:items-start">
		<!-- Left Column: Classes + Add Todo -->
		<div class="space-y-6 xl:sticky xl:top-6 xl:w-72 xl:shrink-0">
			<!-- Classes Section -->
			<Card.Root>
				<Card.Content class="space-y-3">
					<div class="text-base font-semibold">Classes</div>
					<form
						onsubmit={(e) => {
							e.preventDefault();
							addClass();
						}}
						class="flex flex-wrap items-center gap-2"
					>
						<Input
							bind:value={newClassName}
							placeholder="Class name..."
							class="h-8 flex-1 text-sm"
						/>
						<input
							type="color"
							bind:value={newClassColor}
							class="h-8 w-10 cursor-pointer rounded border-0 p-0"
						/>
						<Button type="submit" size="sm" disabled={!newClassName.trim()}>Add</Button>
					</form>

					{#if classes.length > 0}
						<div class="flex flex-wrap gap-1.5">
							{#each classes as cls (cls.id)}
								<Badge
									class="gap-1 px-2 py-0.5 text-xs text-white"
									style="background-color: {cls.color}"
								>
									{cls.name}
									<button onclick={() => removeClass(cls.id)} class="ml-0.5 hover:opacity-70">
										<X class="h-3 w-3" />
									</button>
								</Badge>
							{/each}
						</div>
					{/if}
				</Card.Content>
			</Card.Root>

			<!-- Add Todo Section -->
			<Card.Root>
				<Card.Content class="space-y-3">
					<div class="text-base font-semibold">Add Todo</div>
					<form
						onsubmit={(e) => {
							e.preventDefault();
							addTodo();
						}}
						class="space-y-3"
					>
						<Input bind:value={newTodo} placeholder="What needs to be done?" class="h-8 text-sm" />
						<select
							bind:value={selectedClassId}
							class="h-8 w-full rounded-md border border-input bg-background px-2 text-sm"
						>
							<option value={null}>No class</option>
							{#each classes as cls (cls.id)}
								<option value={cls.id}>{cls.name}</option>
							{/each}
						</select>

						<div class="grid grid-cols-2 gap-2">
							<div>
								<Label class="text-xs text-muted-foreground">Due</Label>
								<Input type="date" bind:value={newEndDate} class="h-7 text-xs" />
							</div>
							<div>
								<Label class="text-xs text-muted-foreground">Time</Label>
								<Input type="time" bind:value={newEndTime} class="h-7 text-xs" />
							</div>
						</div>

						<div class="grid grid-cols-2 gap-2">
							<div>
								<Label class="text-xs text-muted-foreground">Start</Label>
								<Input type="date" bind:value={newStartDate} class="h-7 text-xs" />
							</div>
							<div>
								<Label class="text-xs text-muted-foreground">Time</Label>
								<Input type="time" bind:value={newStartTime} class="h-7 text-xs" />
							</div>
						</div>

						<div class="flex items-center gap-2">
							<Label class="text-xs text-muted-foreground">Repeat</Label>
							<Input
								type="number"
								bind:value={repeatCount}
								min="1"
								max="52"
								class="h-7 w-16 text-xs"
							/>
							<span class="text-xs text-muted-foreground">weeks</span>
						</div>

						<Button type="submit" class="h-8 w-full text-sm" disabled={!newTodo.trim()}
							>Add Todo</Button
						>
					</form>
				</Card.Content>
			</Card.Root>

			<div class="space-y-2">
				<div class="flex gap-2">
					<Button variant="outline" size="sm" class="h-7 flex-1 text-xs" onclick={clearAllData}
						>Clear all</Button
					>
					<Button variant="outline" size="sm" class="h-7 flex-1 text-xs" onclick={resetToMockData}
						>Reset</Button
					>
				</div>
				<div class="flex gap-2">
					<Button variant="outline" size="sm" class="h-7 flex-1 text-xs" onclick={copyToClipboard}
						>Copy</Button
					>
					<Button variant="outline" size="sm" class="h-7 flex-1 text-xs" onclick={downloadAsJson}
						>Download</Button
					>
				</div>
				<div class="flex gap-2">
					<Button
						variant="outline"
						size="sm"
						class="h-7 flex-1 text-xs"
						onclick={pasteFromClipboard}>Paste</Button
					>
					<Button variant="outline" size="sm" class="h-7 flex-1 text-xs" onclick={uploadFromFile}
						>Upload</Button
					>
				</div>
			</div>
		</div>

		<!-- Middle Column: Tasks -->
		<div class="min-w-0 flex-1 space-y-6">
			{#snippet taskItem(item: ViewItem)}
				{@const itemClass = getClass(item.classId)}
				{@const bgClass = getItemBackgroundClass(item)}
				<Card.Root class="{bgClass} py-3">
					<Card.Content class="space-y-2 px-4">
						<div class="flex items-center gap-3">
							<Checkbox
								checked={item.done}
								onCheckedChange={() => toggleDone(item)}
								class="h-5 w-5 bg-white"
							/>
							<span class={item.done ? 'flex-1 text-muted-foreground line-through' : 'flex-1'}>
								{item.text}
							</span>
							{#if item.isRecurringInstance && item.weekNumber}
								<Badge variant="outline" class="gap-1 text-xs">
									<Repeat class="h-3 w-3" />
									Week {item.weekNumber}
								</Badge>
							{/if}
							{#if itemClass}
								<span
									class="h-3 w-3 shrink-0 rounded-full"
									style="background-color: {itemClass.color}"
									title={itemClass.name}
								></span>
							{/if}
							{#if !item.isRecurringInstance && item.todoRef}
								<select
									bind:value={item.todoRef.classId}
									class="h-7 rounded-md border border-input bg-background px-2 text-xs"
								>
									<option value={null}>No class</option>
									{#each classes as cls (cls.id)}
										<option value={cls.id}>{cls.name}</option>
									{/each}
								</select>
								<Button
									variant="ghost"
									size="icon"
									class="h-7 w-7 {item.notes.length > 0
										? 'opacity-100'
										: 'opacity-40 hover:opacity-100'}"
									onclick={() => toggleNotes(item.id)}
								>
									<NotebookPen class="h-4 w-4" />
								</Button>
								<Button
									variant="ghost"
									size="icon"
									class="h-7 w-7"
									onclick={() => removeTodo(item.todoRef!.id)}
								>
									<X class="h-4 w-4" />
								</Button>
							{/if}
						</div>

						{#if item.isRecurringInstance}
							{#if item.endDate || item.startDate}
								<div class="flex gap-4 text-xs text-muted-foreground">
									{#if item.endDate}
										<span>Due {formatDateTime(item.endDate, item.endTime)}</span>
									{/if}
									{#if item.startDate}
										<span>Start {formatDateTime(item.startDate, item.startTime)}</span>
									{/if}
								</div>
							{/if}
						{:else if item.todoRef}
							<div class="flex flex-wrap items-center gap-3">
								<div class="flex items-center gap-1">
									<Label class="text-xs text-muted-foreground">Due</Label>
									<Input type="date" bind:value={item.todoRef.endDate} class="h-6 w-32 text-xs" />
									<Input type="time" bind:value={item.todoRef.endTime} class="h-6 w-24 text-xs" />
								</div>
								<div class="flex items-center gap-1">
									<Label class="text-xs text-muted-foreground">Start</Label>
									<Input type="date" bind:value={item.todoRef.startDate} class="h-6 w-32 text-xs" />
									<Input type="time" bind:value={item.todoRef.startTime} class="h-6 w-24 text-xs" />
								</div>
							</div>

							{#if expandedTodoId === item.id}
								<Textarea
									bind:value={item.todoRef.notes}
									placeholder="Add notes..."
									class="min-h-16 bg-white text-sm"
								/>
							{/if}
						{/if}
					</Card.Content>
				</Card.Root>
			{/snippet}

			{#snippet sectionBlock(section: SectionConfig)}
				{#if section.items.length > 0}
					<section class="space-y-2">
						<button onclick={() => toggleSection(section.key)} class="flex items-center gap-1">
							{#if collapsedSections.has(section.key)}
								<ChevronRight class="h-4 w-4" />
							{:else}
								<ChevronDown class="h-4 w-4" />
							{/if}
							<Badge class={section.badgeClass}>{section.label} ({section.items.length})</Badge>
						</button>
						{#if !collapsedSections.has(section.key)}
							{#each section.items as item (item.id)}
								<div
									in:receive={{ key: item.id }}
									out:send={{ key: item.id }}
									animate:flip={{ duration: 600 }}
								>
									{@render taskItem(item)}
								</div>
							{/each}
						{/if}
					</section>
				{/if}
			{/snippet}

			{#each sections as section (section.key)}
				{@render sectionBlock(section)}
			{/each}

			{#if allViewItems.length === 0}
				<Card.Root>
					<Card.Content class="py-8 text-center">
						<p class="text-muted-foreground">No todos yet. Add one using the forms!</p>
					</Card.Content>
				</Card.Root>
			{/if}
		</div>

		<!-- Right Column: Recurring Tasks -->
		{#if recurringTasks.length > 0}
			<div class="space-y-4 xl:sticky xl:top-6 xl:w-80 xl:shrink-0">
				<div class="flex items-center gap-2 text-sm font-medium">
					<Repeat class="h-4 w-4" />
					Recurring Tasks
				</div>
				<div class="max-h-[80vh] space-y-3 overflow-y-auto">
					{#each recurringTasks as task (task.id)}
						{@const taskClass = getClass(task.classId)}
						<Card.Root class="py-3">
							<Card.Content class="space-y-2 px-4">
								<div class="flex items-center gap-2">
									<span class="flex-1 text-sm font-medium">{task.text}</span>
									{#if taskClass}
										<span
											class="h-3 w-3 shrink-0 rounded-full"
											style="background-color: {taskClass.color}"
											title={taskClass.name}
										></span>
									{/if}
									<Button
										variant="ghost"
										size="icon"
										class="h-6 w-6"
										onclick={() => removeRecurringTask(task.id)}
									>
										<X class="h-3 w-3" />
									</Button>
								</div>

								<div class="grid grid-cols-2 gap-2">
									<div>
										<Label class="text-xs text-muted-foreground">First due</Label>
										<Input type="date" bind:value={task.endDate} class="h-6 text-xs" />
									</div>
									<div>
										<Label class="text-xs text-muted-foreground">Time</Label>
										<Input type="time" bind:value={task.endTime} class="h-6 text-xs" />
									</div>
								</div>

								<div class="grid grid-cols-2 gap-2">
									<div>
										<Label class="text-xs text-muted-foreground">First start</Label>
										<Input type="date" bind:value={task.startDate} class="h-6 text-xs" />
									</div>
									<div>
										<Label class="text-xs text-muted-foreground">Time</Label>
										<Input type="time" bind:value={task.startTime} class="h-6 text-xs" />
									</div>
								</div>

								<div class="flex items-center gap-2">
									<Label class="text-xs text-muted-foreground">Weeks</Label>
									<Input
										type="number"
										bind:value={task.repeatCount}
										min="1"
										max="52"
										class="h-6 w-14 text-xs"
									/>
									<span class="text-xs text-muted-foreground">
										({Object.keys(task.completedWeeks).length}/{task.repeatCount} done)
									</span>
								</div>

								<select
									bind:value={task.classId}
									class="h-6 w-full rounded-md border border-input bg-background px-2 text-xs"
								>
									<option value={null}>No class</option>
									{#each classes as cls (cls.id)}
										<option value={cls.id}>{cls.name}</option>
									{/each}
								</select>
							</Card.Content>
						</Card.Root>
					{/each}
				</div>
			</div>
		{/if}
	</div>
</div>
