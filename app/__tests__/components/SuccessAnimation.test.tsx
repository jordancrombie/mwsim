/**
 * Tests for the SuccessAnimation component.
 *
 * Tests rendering, accessibility, and callback behavior.
 */

import React from 'react';
import { render, act } from '@testing-library/react-native';
import { SuccessAnimation } from '../../src/components/SuccessAnimation';

// Mock the Animated API
jest.useFakeTimers();

describe('SuccessAnimation', () => {
  it('should render with default message', () => {
    const onComplete = jest.fn();
    const { getByText } = render(
      <SuccessAnimation onComplete={onComplete} />
    );

    expect(getByText('Payment Approved')).toBeTruthy();
  });

  it('should render with custom message', () => {
    const onComplete = jest.fn();
    const { getByText } = render(
      <SuccessAnimation onComplete={onComplete} message="Transaction Complete" />
    );

    expect(getByText('Transaction Complete')).toBeTruthy();
  });

  it('should render checkmark', () => {
    const onComplete = jest.fn();
    const { getByText } = render(
      <SuccessAnimation onComplete={onComplete} />
    );

    expect(getByText('✓')).toBeTruthy();
  });

  it('should call onComplete after animation completes', () => {
    const onComplete = jest.fn();
    render(
      <SuccessAnimation
        onComplete={onComplete}
        animationDuration={100}
        delayAfterAnimation={100}
      />
    );

    expect(onComplete).not.toHaveBeenCalled();

    // Fast-forward through all timers
    act(() => {
      jest.runAllTimers();
    });

    expect(onComplete).toHaveBeenCalledTimes(1);
  });

  it('should accept custom animation duration', () => {
    const onComplete = jest.fn();
    const { getByText } = render(
      <SuccessAnimation
        onComplete={onComplete}
        animationDuration={500}
      />
    );

    expect(getByText('Payment Approved')).toBeTruthy();
  });

  it('should accept custom delay after animation', () => {
    const onComplete = jest.fn();
    const { getByText } = render(
      <SuccessAnimation
        onComplete={onComplete}
        delayAfterAnimation={3000}
      />
    );

    expect(getByText('Payment Approved')).toBeTruthy();
  });
});
