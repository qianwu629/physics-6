import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { useSimulationStore } from '../store';
import CreationDialog, { creationSchema, type CreationFormData } from '../components/CreationDialog';

// Mock entity factories to spy on position parameter
vi.mock('../ecs/Entity', async () => {
  const actual = await vi.importActual<typeof import('../ecs/Entity')>('../ecs/Entity');
  return {
    ...actual,
    createSphereEntity: vi.fn((...args: unknown[]) => {
      const factory = actual.createSphereEntity;
      return (factory as (...a: unknown[]) => unknown)(...args);
    }),
    createBoxEntity: vi.fn((...args: unknown[]) => {
      const factory = actual.createBoxEntity;
      return (factory as (...a: unknown[]) => unknown)(...args);
    }),
    createCylinderEntity: vi.fn((...args: unknown[]) => {
      const factory = actual.createCylinderEntity;
      return (factory as (...a: unknown[]) => unknown)(...args);
    }),
    createSlopeEntity: vi.fn((...args: unknown[]) => {
      const factory = actual.createSlopeEntity;
      return (factory as (...a: unknown[]) => unknown)(...args);
    }),
  };
});

describe('CreationDialog — position fields', () => {
  beforeEach(() => {
    // Reset store state and open dialog with sphere preset
    useSimulationStore.setState({
      dialogOpen: true,
      dialogDefaultShape: 'sphere',
      entities: new Map(),
    });
  });

  it('renders position fields with default values (0, 5, 0)', async () => {
    render(<CreationDialog />);

    // The Dialog renders in a portal; get the dialog content
    const dialog = await screen.findByRole('dialog');
    expect(dialog).toBeInTheDocument();

    // Find "初始位置" label
    expect(screen.getByText('初始位置')).toBeInTheDocument();

    // Find X, Y, Z input fields by their labels
    const xInput = screen.getByLabelText('X');
    const yInput = screen.getByLabelText('Y');
    const zInput = screen.getByLabelText('Z');

    expect(xInput).toBeInTheDocument();
    expect(yInput).toBeInTheDocument();
    expect(zInput).toBeInTheDocument();

    // Default values
    expect(xInput).toHaveValue(0);
    expect(yInput).toHaveValue(5);
    expect(zInput).toHaveValue(0);
  });

  it('passes position to factory on submit', async () => {
    render(<CreationDialog />);

    const dialog = await screen.findByRole('dialog');
    expect(dialog).toBeInTheDocument();

    // Change Y position to 10
    const yInput = screen.getByLabelText('Y');
    fireEvent.change(yInput, { target: { value: '10' } });

    // Submit the form
    const submitButton = screen.getByRole('button', { name: /确认添加/ });
    fireEvent.click(submitButton);

    const { createSphereEntity } = await import('../ecs/Entity');
    await waitFor(() => {
      expect(createSphereEntity).toHaveBeenCalled();
    });

    // The factory should have been called with position [0, 10, 0]
    const calls = (createSphereEntity as ReturnType<typeof vi.fn>).mock.calls;
    const lastCall = calls[calls.length - 1];
    // createSphereEntity(radius, mass, restitution, friction, color, velocity, position)
    // position is the 7th argument (index 6)
    const position = lastCall[6];
    expect(position).toEqual([0, 10, 0]);
  });
});

describe('creationSchema — position validation', () => {
  it('includes positionX/positionY/positionZ with defaults', () => {
    const result = creationSchema.parse({
      shape: 'sphere',
      radius: 1.0,
      mass: 1.0,
      restitution: 0.5,
      friction: 0.3,
    });

    expect(result.positionX).toBe(0);
    expect(result.positionY).toBe(5);
    expect(result.positionZ).toBe(0);
  });

  it('parses custom position values', () => {
    const result = creationSchema.parse({
      shape: 'sphere',
      radius: 1.0,
      mass: 1.0,
      restitution: 0.5,
      friction: 0.3,
      positionX: 3,
      positionY: 8,
      positionZ: -2,
    });

    expect(result.positionX).toBe(3);
    expect(result.positionY).toBe(8);
    expect(result.positionZ).toBe(-2);
  });
});
