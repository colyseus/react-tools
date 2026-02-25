import 'reflect-metadata';
import { renderHook, act } from '@testing-library/react';
import { describe, expect, test } from 'vitest';
import { useColyseusState } from '../schema/useColyseusState';
import { simulateState } from './schema/simulateState';
import { ArrayRootState, Task } from './schema/ArrayRootState';
import { NestedArrayState, Conversation, Message } from './schema/NestedArrayState';

describe('arrays at root level', () => {
  describe('adding objects to array', () => {
    const { clientState, decoder, updateState } = simulateState(() => new ArrayRootState());
    const { result } = renderHook(() => useColyseusState(clientState, decoder));

    test('initially empty array', () => {
      const state = result.current;
      expect(state.tasks.length).toBe(0);
    });

    test('adding first task creates new array reference', () => {
      const stateBefore = result.current;

      act(() => {
        updateState((state) => {
          state.tasks.push(new Task("First task", false));
        });
      });

      const stateAfter = result.current;

      // Root and array should have changed
      expect(stateBefore).not.toBe(stateAfter);
      expect(stateBefore.tasks).not.toBe(stateAfter.tasks);

      // Array should have one item
      expect(stateAfter.tasks.length).toBe(1);
      expect(stateAfter.tasks[0].title).toBe("First task");
      expect(stateAfter.tasks[0].completed).toBe(false);
    });

    test('adding second task creates new array but keeps first task reference', () => {
      const stateBefore = result.current;
      const firstTaskBefore = stateBefore.tasks[0];

      act(() => {
        updateState((state) => {
          state.tasks.push(new Task("Second task", false));
        });
      });

      const stateAfter = result.current;

      // Root and array should have changed
      expect(stateBefore).not.toBe(stateAfter);
      expect(stateBefore.tasks).not.toBe(stateAfter.tasks);

      // Array should have two items
      expect(stateAfter.tasks.length).toBe(2);

      // First task reference should be unchanged
      expect(stateAfter.tasks[0]).toBe(firstTaskBefore);

      // Second task should be new
      expect(stateAfter.tasks[1].title).toBe("Second task");
    });
  });

  describe('modifying objects in array', () => {
    const { clientState, decoder, updateState } = simulateState(() => new ArrayRootState());
    const { result } = renderHook(() => useColyseusState(clientState, decoder));

    // Add some tasks
    act(() => {
      updateState((state) => {
        state.tasks.push(new Task("Task 1", false));
        state.tasks.push(new Task("Task 2", false));
        state.tasks.push(new Task("Task 3", false));
      });
    });

    test('modifying first task changes its reference but not others', () => {
      const stateBefore = result.current;
      const task2Before = stateBefore.tasks[1];
      const task3Before = stateBefore.tasks[2];

      act(() => {
        updateState((state) => {
          state.tasks[0].completed = true;
        });
      });

      const stateAfter = result.current;

      // Root and array should have changed
      expect(stateBefore).not.toBe(stateAfter);
      expect(stateBefore.tasks).not.toBe(stateAfter.tasks);

      // First task should have changed
      expect(stateBefore.tasks[0]).not.toBe(stateAfter.tasks[0]);
      expect(stateAfter.tasks[0].completed).toBe(true);

      // Other tasks should be unchanged
      expect(stateAfter.tasks[1]).toBe(task2Before);
      expect(stateAfter.tasks[2]).toBe(task3Before);
    });

    test('modifying middle task changes its reference but not others', () => {
      const stateBefore = result.current;
      const task1Before = stateBefore.tasks[0];
      const task3Before = stateBefore.tasks[2];

      act(() => {
        updateState((state) => {
          state.tasks[1].priority = 5;
        });
      });

      const stateAfter = result.current;

      // Root and array should have changed
      expect(stateBefore).not.toBe(stateAfter);
      expect(stateBefore.tasks).not.toBe(stateAfter.tasks);

      // Middle task should have changed
      expect(stateBefore.tasks[1]).not.toBe(stateAfter.tasks[1]);
      expect(stateAfter.tasks[1].priority).toBe(5);

      // Other tasks should be unchanged
      expect(stateAfter.tasks[0]).toBe(task1Before);
      expect(stateAfter.tasks[2]).toBe(task3Before);
    });

    test('modifying last task changes its reference but not others', () => {
      const stateBefore = result.current;
      const task1Before = stateBefore.tasks[0];
      const task2Before = stateBefore.tasks[1];

      act(() => {
        updateState((state) => {
          state.tasks[2].priority = 10;
        });
      });

      const stateAfter = result.current;

      // Root and array should have changed
      expect(stateBefore).not.toBe(stateAfter);
      expect(stateBefore.tasks).not.toBe(stateAfter.tasks);

      // Last task should have changed
      expect(stateBefore.tasks[2]).not.toBe(stateAfter.tasks[2]);
      expect(stateAfter.tasks[2].priority).toBe(10);

      // Other tasks should be unchanged
      expect(stateAfter.tasks[0]).toBe(task1Before);
      expect(stateAfter.tasks[1]).toBe(task2Before);
    });
  });

  describe('removing objects from array', () => {
    const { clientState, decoder, updateState } = simulateState(() => new ArrayRootState());
    const { result } = renderHook(() => useColyseusState(clientState, decoder));

    // Add some tasks
    act(() => {
      updateState((state) => {
        state.tasks.push(new Task("Task A", false));
        state.tasks.push(new Task("Task B", false));
        state.tasks.push(new Task("Task C", false));
        state.tasks.push(new Task("Task D", false));
      });
    });

    test('removing last task with pop keeps other references', () => {
      const stateBefore = result.current;
      const taskABefore = stateBefore.tasks[0];
      const taskBBefore = stateBefore.tasks[1];
      const taskCBefore = stateBefore.tasks[2];

      act(() => {
        updateState((state) => {
          state.tasks.pop();
        });
      });

      const stateAfter = result.current;

      // Root and array should have changed
      expect(stateBefore).not.toBe(stateAfter);
      expect(stateBefore.tasks).not.toBe(stateAfter.tasks);

      // Array length should be reduced
      expect(stateAfter.tasks.length).toBe(3);

      // Remaining tasks should have same references
      expect(stateAfter.tasks[0]).toBe(taskABefore);
      expect(stateAfter.tasks[1]).toBe(taskBBefore);
      expect(stateAfter.tasks[2]).toBe(taskCBefore);
    });

    test('removing first task with splice shifts others', () => {
      const stateBefore = result.current;
      const taskBBefore = stateBefore.tasks[1];
      const taskCBefore = stateBefore.tasks[2];

      act(() => {
        updateState((state) => {
          state.tasks.splice(0, 1);
        });
      });

      const stateAfter = result.current;

      // Root and array should have changed
      expect(stateBefore).not.toBe(stateAfter);
      expect(stateBefore.tasks).not.toBe(stateAfter.tasks);

      // Array length should be reduced
      expect(stateAfter.tasks.length).toBe(2);

      // Tasks B and C should have same references but at new indices
      expect(stateAfter.tasks[0]).toBe(taskBBefore);
      expect(stateAfter.tasks[0].title).toBe("Task B");
      expect(stateAfter.tasks[1]).toBe(taskCBefore);
      expect(stateAfter.tasks[1].title).toBe("Task C");
    });

    test('removing middle task with splice keeps appropriate references', () => {
      const stateBefore = result.current;
      const taskCBefore = stateBefore.tasks[1]; // Task C is now at index 1

      act(() => {
        updateState((state) => {
          state.tasks.splice(0, 1); // Remove Task B
        });
      });

      const stateAfter = result.current;

      // Root and array should have changed
      expect(stateBefore).not.toBe(stateAfter);
      expect(stateBefore.tasks).not.toBe(stateAfter.tasks);

      // Array length should be reduced
      expect(stateAfter.tasks.length).toBe(1);

      // Task C should have same reference at new index
      expect(stateAfter.tasks[0]).toBe(taskCBefore);
      expect(stateAfter.tasks[0].title).toBe("Task C");
    });
  });

  describe('unrelated state changes should not cause array iteration', () => {
    const { clientState, decoder, updateState } = simulateState(() => new ArrayRootState());
    const { result } = renderHook(() => useColyseusState(clientState, decoder));

    // Add multiple tasks to the array
    act(() => {
      updateState((state) => {
        for (let i = 0; i < 10; i++) {
          state.tasks.push(new Task(`Task ${i}`, false));
        }
      });
    });

    test('changing unrelated field keeps array reference unchanged', () => {
      const stateBefore = result.current;
      const tasksBefore = stateBefore.tasks;

      act(() => {
        updateState((state) => {
          state.version = 1; // Change unrelated field
        });
      });

      const stateAfter = result.current;

      // Root should have changed
      expect(stateBefore).not.toBe(stateAfter);
      expect(stateAfter.version).toBe(1);

      // Array reference should NOT have changed
      expect(stateAfter.tasks).toBe(tasksBefore);

      // All task references should be unchanged
      for (let i = 0; i < tasksBefore.length; i++) {
        expect(stateAfter.tasks[i]).toBe(tasksBefore[i]);
      }
    });
  });
});

describe('nested arrays', () => {
  describe('adding objects to nested arrays', () => {
    const { clientState, decoder, updateState } = simulateState(() => new NestedArrayState());
    const { result } = renderHook(() => useColyseusState(clientState, decoder));

    test('initially empty', () => {
      const state = result.current;
      expect(state.conversations.length).toBe(0);
    });

    test('adding first conversation', () => {
      const stateBefore = result.current;

      act(() => {
        updateState((state) => {
          state.conversations.push(new Conversation("General"));
        });
      });

      const stateAfter = result.current;

      // Root and conversations array should have changed
      expect(stateBefore).not.toBe(stateAfter);
      expect(stateBefore.conversations).not.toBe(stateAfter.conversations);

      // Should have one conversation
      expect(stateAfter.conversations.length).toBe(1);
      expect(stateAfter.conversations[0].topic).toBe("General");
      expect(stateAfter.conversations[0].messages.length).toBe(0);
    });

    test('adding message to conversation', () => {
      const stateBefore = result.current;
      const conversationBefore = stateBefore.conversations[0];

      act(() => {
        updateState((state) => {
          state.conversations[0].messages.push(new Message("Hello", "Alice"));
        });
      });

      const stateAfter = result.current;

      // Root and conversations should have changed
      expect(stateBefore).not.toBe(stateAfter);
      expect(stateBefore.conversations).not.toBe(stateAfter.conversations);

      // Conversation should have changed
      expect(conversationBefore).not.toBe(stateAfter.conversations[0]);

      // Messages array should have changed
      expect(conversationBefore.messages).not.toBe(stateAfter.conversations[0].messages);

      // Should have one message
      expect(stateAfter.conversations[0].messages.length).toBe(1);
      expect(stateAfter.conversations[0].messages[0].text).toBe("Hello");
      expect(stateAfter.conversations[0].messages[0].sender).toBe("Alice");
    });

    test('adding second conversation keeps first unchanged', () => {
      const stateBefore = result.current;
      const conv1Before = stateBefore.conversations[0];

      act(() => {
        updateState((state) => {
          state.conversations.push(new Conversation("Random"));
        });
      });

      const stateAfter = result.current;

      // Root and conversations should have changed
      expect(stateBefore).not.toBe(stateAfter);
      expect(stateBefore.conversations).not.toBe(stateAfter.conversations);

      // First conversation reference should be unchanged
      expect(stateAfter.conversations[0]).toBe(conv1Before);

      // Should have two conversations
      expect(stateAfter.conversations.length).toBe(2);
      expect(stateAfter.conversations[1].topic).toBe("Random");
    });
  });

  describe('modifying objects in nested arrays', () => {
    const { clientState, decoder, updateState } = simulateState(() => new NestedArrayState());
    const { result } = renderHook(() => useColyseusState(clientState, decoder));

    // Set up some conversations with messages
    act(() => {
      updateState((state) => {
        const conv1 = new Conversation("Topic 1");
        conv1.messages.push(new Message("Message 1", "User1"));
        conv1.messages.push(new Message("Message 2", "User2"));
        state.conversations.push(conv1);

        const conv2 = new Conversation("Topic 2");
        conv2.messages.push(new Message("Message A", "UserA"));
        state.conversations.push(conv2);
      });
    });

    test('modifying message in first conversation does not affect second', () => {
      const stateBefore = result.current;
      const conv2Before = stateBefore.conversations[1];
      const msg2Before = stateBefore.conversations[0].messages[1];

      act(() => {
        updateState((state) => {
          state.conversations[0].messages[0].timestamp = 12345;
        });
      });

      const stateAfter = result.current;

      // Root, conversations, first conversation, and its messages should have changed
      expect(stateBefore).not.toBe(stateAfter);
      expect(stateBefore.conversations).not.toBe(stateAfter.conversations);
      expect(stateBefore.conversations[0]).not.toBe(stateAfter.conversations[0]);
      expect(stateBefore.conversations[0].messages).not.toBe(stateAfter.conversations[0].messages);
      expect(stateBefore.conversations[0].messages[0]).not.toBe(stateAfter.conversations[0].messages[0]);

      // Modified message should have new timestamp
      expect(stateAfter.conversations[0].messages[0].timestamp).toBe(12345);

      // Second message in first conversation should be unchanged
      expect(stateAfter.conversations[0].messages[1]).toBe(msg2Before);

      // Second conversation should be completely unchanged
      expect(stateAfter.conversations[1]).toBe(conv2Before);
    });

    test('modifying conversation property does not reallocate its messages', () => {
      const stateBefore = result.current;
      const messagesBefore = stateBefore.conversations[0].messages;
      const msg1Before = stateBefore.conversations[0].messages[0];
      const msg2Before = stateBefore.conversations[0].messages[1];

      act(() => {
        updateState((state) => {
          state.conversations[0].archived = true;
        });
      });

      const stateAfter = result.current;

      // Root, conversations, and first conversation should have changed
      expect(stateBefore).not.toBe(stateAfter);
      expect(stateBefore.conversations).not.toBe(stateAfter.conversations);
      expect(stateBefore.conversations[0]).not.toBe(stateAfter.conversations[0]);

      // Archived should be updated
      expect(stateAfter.conversations[0].archived).toBe(true);

      // Messages array should NOT have changed
      expect(stateAfter.conversations[0].messages).toBe(messagesBefore);

      // Individual messages should NOT have changed
      expect(stateAfter.conversations[0].messages[0]).toBe(msg1Before);
      expect(stateAfter.conversations[0].messages[1]).toBe(msg2Before);
    });
  });

  describe('removing objects from nested arrays', () => {
    const { clientState, decoder, updateState } = simulateState(() => new NestedArrayState());
    const { result } = renderHook(() => useColyseusState(clientState, decoder));

    // Set up conversations with messages
    act(() => {
      updateState((state) => {
        const conv1 = new Conversation("Conv1");
        conv1.messages.push(new Message("Msg1", "User1"));
        conv1.messages.push(new Message("Msg2", "User2"));
        conv1.messages.push(new Message("Msg3", "User3"));
        state.conversations.push(conv1);

        const conv2 = new Conversation("Conv2");
        conv2.messages.push(new Message("MsgA", "UserA"));
        state.conversations.push(conv2);
      });
    });

    test('removing message from conversation keeps other messages', () => {
      const stateBefore = result.current;
      const msg1Before = stateBefore.conversations[0].messages[0];
      const msg3Before = stateBefore.conversations[0].messages[2];
      const conv2Before = stateBefore.conversations[1];

      act(() => {
        updateState((state) => {
          state.conversations[0].messages.splice(1, 1); // Remove middle message
        });
      });

      const stateAfter = result.current;

      // Root, conversations, first conversation, and its messages should have changed
      expect(stateBefore).not.toBe(stateAfter);
      expect(stateBefore.conversations).not.toBe(stateAfter.conversations);
      expect(stateBefore.conversations[0]).not.toBe(stateAfter.conversations[0]);
      expect(stateBefore.conversations[0].messages).not.toBe(stateAfter.conversations[0].messages);

      // Should have 2 messages left
      expect(stateAfter.conversations[0].messages.length).toBe(2);

      // First message should be unchanged
      expect(stateAfter.conversations[0].messages[0]).toBe(msg1Before);

      // Third message should now be at index 1, with same reference
      expect(stateAfter.conversations[0].messages[1]).toBe(msg3Before);

      // Second conversation should be unchanged
      expect(stateAfter.conversations[1]).toBe(conv2Before);
    });

    test('removing entire conversation keeps other conversations', () => {
      const stateBefore = result.current;
      const conv2Before = stateBefore.conversations[1];

      act(() => {
        updateState((state) => {
          state.conversations.splice(0, 1); // Remove first conversation
        });
      });

      const stateAfter = result.current;

      // Root and conversations should have changed
      expect(stateBefore).not.toBe(stateAfter);
      expect(stateBefore.conversations).not.toBe(stateAfter.conversations);

      // Should have 1 conversation left
      expect(stateAfter.conversations.length).toBe(1);

      // Second conversation should now be at index 0, with same reference
      expect(stateAfter.conversations[0]).toBe(conv2Before);
      expect(stateAfter.conversations[0].topic).toBe("Conv2");
    });
  });

  describe('unrelated changes in nested structure', () => {
    const { clientState, decoder, updateState } = simulateState(() => new NestedArrayState());
    const { result } = renderHook(() => useColyseusState(clientState, decoder));

    // Set up conversations
    act(() => {
      updateState((state) => {
        const conv1 = new Conversation("General");
        conv1.messages.push(new Message("Hello", "Alice"));
        conv1.messages.push(new Message("Hi", "Bob"));
        state.conversations.push(conv1);

        const conv2 = new Conversation("Random");
        conv2.messages.push(new Message("Test", "Charlie"));
        state.conversations.push(conv2);
      });
    });

    test('changing root field does not reallocate conversations or messages', () => {
      const stateBefore = result.current;
      const conversationsBefore = stateBefore.conversations;
      const conv1Before = stateBefore.conversations[0];
      const conv2Before = stateBefore.conversations[1];

      act(() => {
        updateState((state) => {
          state.activeUser = "Alice"; // Change unrelated field
        });
      });

      const stateAfter = result.current;

      // Root should have changed
      expect(stateBefore).not.toBe(stateAfter);
      expect(stateAfter.activeUser).toBe("Alice");

      // Conversations array should NOT have changed
      expect(stateAfter.conversations).toBe(conversationsBefore);

      // Individual conversations should NOT have changed
      expect(stateAfter.conversations[0]).toBe(conv1Before);
      expect(stateAfter.conversations[1]).toBe(conv2Before);

      // Messages should also be unchanged
      expect(stateAfter.conversations[0].messages).toBe(conv1Before.messages);
      expect(stateAfter.conversations[1].messages).toBe(conv2Before.messages);
    });

    test('changing second conversation does not affect first', () => {
      const stateBefore = result.current;
      const conv1Before = stateBefore.conversations[0];
      const conv1MessagesBefore = stateBefore.conversations[0].messages;

      act(() => {
        updateState((state) => {
          state.conversations[1].archived = true;
        });
      });

      const stateAfter = result.current;

      // Root, conversations, and second conversation should have changed
      expect(stateBefore).not.toBe(stateAfter);
      expect(stateBefore.conversations).not.toBe(stateAfter.conversations);
      expect(stateBefore.conversations[1]).not.toBe(stateAfter.conversations[1]);

      // First conversation should be completely unchanged
      expect(stateAfter.conversations[0]).toBe(conv1Before);
      expect(stateAfter.conversations[0].messages).toBe(conv1MessagesBefore);
    });
  });
});
