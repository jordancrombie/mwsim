/**
 * Tests for the OrderSummary component.
 *
 * Tests rendering of order line items, cost breakdown,
 * collapsible behavior, and accessibility features.
 */

import React from 'react';
import { render, fireEvent, screen } from '@testing-library/react-native';
import { OrderSummary } from '../../src/components/OrderSummary';
import type { OrderDetails } from '../../src/types';

describe('OrderSummary', () => {
  const defaultCurrency = 'CAD';

  describe('Line Items', () => {
    it('should render single item correctly', () => {
      const orderDetails: OrderDetails = {
        items: [
          { name: 'Widget Pro', quantity: 1, unitPrice: 89.99 },
        ],
      };

      const { getByText } = render(
        <OrderSummary orderDetails={orderDetails} currency={defaultCurrency} />
      );

      expect(getByText('Widget Pro')).toBeTruthy();
      expect(getByText(/x1 @/)).toBeTruthy();
      expect(getByText('$89.99')).toBeTruthy();
    });

    it('should render multiple items', () => {
      const orderDetails: OrderDetails = {
        items: [
          { name: 'Widget Pro', quantity: 1, unitPrice: 89.99 },
          { name: 'USB-C Cable', quantity: 2, unitPrice: 9.99 },
        ],
      };

      const { getByText } = render(
        <OrderSummary orderDetails={orderDetails} currency={defaultCurrency} />
      );

      expect(getByText('Widget Pro')).toBeTruthy();
      expect(getByText('USB-C Cable')).toBeTruthy();
    });

    it('should calculate line total correctly', () => {
      const orderDetails: OrderDetails = {
        items: [
          { name: 'Cable', quantity: 3, unitPrice: 10.00 },
        ],
      };

      const { getByText } = render(
        <OrderSummary orderDetails={orderDetails} currency={defaultCurrency} />
      );

      // 3 x $10 = $30
      expect(getByText('$30.00')).toBeTruthy();
    });

    it('should handle decimal quantities', () => {
      const orderDetails: OrderDetails = {
        items: [
          { name: 'Coffee Beans', quantity: 1.5, unitPrice: 20.00 },
        ],
      };

      const { getByText } = render(
        <OrderSummary orderDetails={orderDetails} currency={defaultCurrency} />
      );

      expect(getByText(/x1.5 @/)).toBeTruthy();
      // 1.5 x $20 = $30
      expect(getByText('$30.00')).toBeTruthy();
    });

    it('should truncate long item names', () => {
      const orderDetails: OrderDetails = {
        items: [
          { name: 'This is a very long product name that should be truncated', quantity: 1, unitPrice: 10.00 },
        ],
      };

      const { getByText } = render(
        <OrderSummary orderDetails={orderDetails} currency={defaultCurrency} />
      );

      // Should show truncated name with ellipsis (35 chars max, including ellipsis)
      expect(getByText(/This is a very long product name t…/)).toBeTruthy();
    });

    it('should not render items section when items array is empty', () => {
      const orderDetails: OrderDetails = {
        items: [],
        subtotal: 50.00,
      };

      const { queryByText } = render(
        <OrderSummary orderDetails={orderDetails} currency={defaultCurrency} />
      );

      expect(queryByText('Order Items')).toBeNull();
    });
  });

  describe('Collapsible Behavior', () => {
    it('should show all items when 5 or fewer', () => {
      const orderDetails: OrderDetails = {
        items: [
          { name: 'Item 1', quantity: 1, unitPrice: 10.00 },
          { name: 'Item 2', quantity: 1, unitPrice: 10.00 },
          { name: 'Item 3', quantity: 1, unitPrice: 10.00 },
          { name: 'Item 4', quantity: 1, unitPrice: 10.00 },
          { name: 'Item 5', quantity: 1, unitPrice: 10.00 },
        ],
      };

      const { getByText, queryByText } = render(
        <OrderSummary orderDetails={orderDetails} currency={defaultCurrency} />
      );

      expect(getByText('Item 1')).toBeTruthy();
      expect(getByText('Item 5')).toBeTruthy();
      expect(queryByText(/View all/)).toBeNull();
    });

    it('should show "View all" when more than 5 items', () => {
      const orderDetails: OrderDetails = {
        items: [
          { name: 'Item 1', quantity: 1, unitPrice: 10.00 },
          { name: 'Item 2', quantity: 1, unitPrice: 10.00 },
          { name: 'Item 3', quantity: 1, unitPrice: 10.00 },
          { name: 'Item 4', quantity: 1, unitPrice: 10.00 },
          { name: 'Item 5', quantity: 1, unitPrice: 10.00 },
          { name: 'Item 6', quantity: 1, unitPrice: 10.00 },
          { name: 'Item 7', quantity: 1, unitPrice: 10.00 },
        ],
      };

      const { getByText, queryByText } = render(
        <OrderSummary orderDetails={orderDetails} currency={defaultCurrency} />
      );

      expect(getByText('Item 1')).toBeTruthy();
      expect(getByText('Item 5')).toBeTruthy();
      expect(queryByText('Item 6')).toBeNull(); // Hidden initially
      expect(getByText(/View all 7 items/)).toBeTruthy();
    });

    it('should expand to show all items when "View all" is pressed', () => {
      const orderDetails: OrderDetails = {
        items: [
          { name: 'Item 1', quantity: 1, unitPrice: 10.00 },
          { name: 'Item 2', quantity: 1, unitPrice: 10.00 },
          { name: 'Item 3', quantity: 1, unitPrice: 10.00 },
          { name: 'Item 4', quantity: 1, unitPrice: 10.00 },
          { name: 'Item 5', quantity: 1, unitPrice: 10.00 },
          { name: 'Item 6', quantity: 1, unitPrice: 10.00 },
        ],
      };

      const { getByText, queryByText } = render(
        <OrderSummary orderDetails={orderDetails} currency={defaultCurrency} />
      );

      // Initially hidden
      expect(queryByText('Item 6')).toBeNull();

      // Press "View all"
      fireEvent.press(getByText(/View all 6 items/));

      // Now visible
      expect(getByText('Item 6')).toBeTruthy();
      expect(getByText('Show fewer items')).toBeTruthy();
    });

    it('should collapse when "Show fewer" is pressed', () => {
      const orderDetails: OrderDetails = {
        items: [
          { name: 'Item 1', quantity: 1, unitPrice: 10.00 },
          { name: 'Item 2', quantity: 1, unitPrice: 10.00 },
          { name: 'Item 3', quantity: 1, unitPrice: 10.00 },
          { name: 'Item 4', quantity: 1, unitPrice: 10.00 },
          { name: 'Item 5', quantity: 1, unitPrice: 10.00 },
          { name: 'Item 6', quantity: 1, unitPrice: 10.00 },
        ],
      };

      const { getByText, queryByText } = render(
        <OrderSummary orderDetails={orderDetails} currency={defaultCurrency} />
      );

      // Expand
      fireEvent.press(getByText(/View all 6 items/));
      expect(getByText('Item 6')).toBeTruthy();

      // Collapse
      fireEvent.press(getByText('Show fewer items'));
      expect(queryByText('Item 6')).toBeNull();
      expect(getByText(/View all 6 items/)).toBeTruthy();
    });
  });

  describe('Cost Breakdown', () => {
    it('should render subtotal', () => {
      const orderDetails: OrderDetails = {
        subtotal: 99.98,
      };

      const { getByText } = render(
        <OrderSummary orderDetails={orderDetails} currency={defaultCurrency} />
      );

      expect(getByText('Subtotal')).toBeTruthy();
      expect(getByText('$99.98')).toBeTruthy();
    });

    it('should render shipping with method', () => {
      const orderDetails: OrderDetails = {
        shipping: { method: 'Express', amount: 15.00 },
      };

      const { getByText } = render(
        <OrderSummary orderDetails={orderDetails} currency={defaultCurrency} />
      );

      expect(getByText('Shipping (Express)')).toBeTruthy();
      expect(getByText('$15.00')).toBeTruthy();
    });

    it('should render shipping without method', () => {
      const orderDetails: OrderDetails = {
        shipping: { amount: 5.00 },
      };

      const { getByText } = render(
        <OrderSummary orderDetails={orderDetails} currency={defaultCurrency} />
      );

      expect(getByText('Shipping')).toBeTruthy();
      expect(getByText('$5.00')).toBeTruthy();
    });

    it('should render tax with label and rate', () => {
      const orderDetails: OrderDetails = {
        tax: { amount: 13.00, rate: 0.13, label: 'HST' },
      };

      const { getByText } = render(
        <OrderSummary orderDetails={orderDetails} currency={defaultCurrency} />
      );

      expect(getByText('HST (13%)')).toBeTruthy();
      expect(getByText('$13.00')).toBeTruthy();
    });

    it('should render tax with label only', () => {
      const orderDetails: OrderDetails = {
        tax: { amount: 8.00, label: 'Sales Tax' },
      };

      const { getByText } = render(
        <OrderSummary orderDetails={orderDetails} currency={defaultCurrency} />
      );

      expect(getByText('Sales Tax')).toBeTruthy();
      expect(getByText('$8.00')).toBeTruthy();
    });

    it('should render tax without label', () => {
      const orderDetails: OrderDetails = {
        tax: { amount: 5.00 },
      };

      const { getByText } = render(
        <OrderSummary orderDetails={orderDetails} currency={defaultCurrency} />
      );

      expect(getByText('Tax')).toBeTruthy();
      expect(getByText('$5.00')).toBeTruthy();
    });

    it('should render fees', () => {
      const orderDetails: OrderDetails = {
        fees: [
          { label: 'Service Fee', amount: 3.00 },
          { label: 'Convenience Fee', amount: 1.50 },
        ],
      };

      const { getByText } = render(
        <OrderSummary orderDetails={orderDetails} currency={defaultCurrency} />
      );

      expect(getByText('Service Fee')).toBeTruthy();
      expect(getByText('$3.00')).toBeTruthy();
      expect(getByText('Convenience Fee')).toBeTruthy();
      expect(getByText('$1.50')).toBeTruthy();
    });

    it('should render discounts with code', () => {
      const orderDetails: OrderDetails = {
        discounts: [
          { code: 'SAVE10', amount: 10.00 },
        ],
      };

      const { getByText } = render(
        <OrderSummary orderDetails={orderDetails} currency={defaultCurrency} />
      );

      expect(getByText('Promo: SAVE10')).toBeTruthy();
      expect(getByText('-$10.00')).toBeTruthy();
    });

    it('should render discounts with description', () => {
      const orderDetails: OrderDetails = {
        discounts: [
          { description: '10% off your order', amount: 10.00 },
        ],
      };

      const { getByText } = render(
        <OrderSummary orderDetails={orderDetails} currency={defaultCurrency} />
      );

      expect(getByText('10% off your order')).toBeTruthy();
      expect(getByText('-$10.00')).toBeTruthy();
    });

    it('should render discount fallback when no code or description', () => {
      const orderDetails: OrderDetails = {
        discounts: [
          { amount: 5.00 },
        ],
      };

      const { getByText } = render(
        <OrderSummary orderDetails={orderDetails} currency={defaultCurrency} />
      );

      expect(getByText('Discount')).toBeTruthy();
      expect(getByText('-$5.00')).toBeTruthy();
    });
  });

  describe('Full Order Scenario', () => {
    it('should render complete order with items and breakdown', () => {
      const orderDetails: OrderDetails = {
        version: 1,
        items: [
          { name: 'Widget Pro', quantity: 1, unitPrice: 89.99 },
          { name: 'USB-C Cable', quantity: 2, unitPrice: 4.995 },
        ],
        subtotal: 99.98,
        shipping: { method: 'Standard', amount: 5.00 },
        tax: { amount: 13.65, rate: 0.13, label: 'HST' },
        discounts: [{ code: 'SAVE10', amount: 10.00 }],
      };

      const { getByText } = render(
        <OrderSummary orderDetails={orderDetails} currency={defaultCurrency} />
      );

      // Items
      expect(getByText('Widget Pro')).toBeTruthy();
      expect(getByText('USB-C Cable')).toBeTruthy();

      // Breakdown
      expect(getByText('Subtotal')).toBeTruthy();
      expect(getByText('$99.98')).toBeTruthy();
      expect(getByText('Shipping (Standard)')).toBeTruthy();
      expect(getByText('$5.00')).toBeTruthy();
      expect(getByText('HST (13%)')).toBeTruthy();
      expect(getByText('$13.65')).toBeTruthy();
      expect(getByText('Promo: SAVE10')).toBeTruthy();
      expect(getByText('-$10.00')).toBeTruthy();
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty orderDetails', () => {
      const orderDetails: OrderDetails = {};

      // Should render without crashing
      const result = render(
        <OrderSummary orderDetails={orderDetails} currency={defaultCurrency} />
      );

      expect(result).toBeTruthy();
    });

    it('should handle zero amounts', () => {
      const orderDetails: OrderDetails = {
        shipping: { method: 'Free Shipping', amount: 0 },
      };

      const { getByText } = render(
        <OrderSummary orderDetails={orderDetails} currency={defaultCurrency} />
      );

      expect(getByText('Shipping (Free Shipping)')).toBeTruthy();
      expect(getByText('$0.00')).toBeTruthy();
    });

    it('should handle different currencies', () => {
      const orderDetails: OrderDetails = {
        subtotal: 100.00,
      };

      const { getByText } = render(
        <OrderSummary orderDetails={orderDetails} currency="USD" />
      );

      expect(getByText('US$100.00')).toBeTruthy();
    });

    it('should handle item with zero unit price', () => {
      const orderDetails: OrderDetails = {
        items: [
          { name: 'Free Gift', quantity: 1, unitPrice: 0 },
        ],
      };

      const { getByText } = render(
        <OrderSummary orderDetails={orderDetails} currency={defaultCurrency} />
      );

      expect(getByText('Free Gift')).toBeTruthy();
      expect(getByText('$0.00')).toBeTruthy();
    });
  });
});
