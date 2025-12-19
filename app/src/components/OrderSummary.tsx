/**
 * OrderSummary component for displaying enhanced purchase information
 * on the payment approval screen.
 *
 * Shows line items, cost breakdown (subtotal, shipping, tax, fees, discounts),
 * with collapsible behavior for long order lists.
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  AccessibilityInfo,
} from 'react-native';
import type {
  OrderDetails,
  OrderLineItem as OrderLineItemType,
  OrderShipping,
  OrderTax,
  OrderDiscount,
  OrderFee,
} from '../types';

interface OrderSummaryProps {
  orderDetails: OrderDetails;
  currency: string;
}

// Number of items to show before "View all" link
const INITIAL_ITEMS_VISIBLE = 5;

/**
 * Format a number as currency
 */
function formatCurrency(amount: number, currency: string): string {
  return new Intl.NumberFormat('en-CA', {
    style: 'currency',
    currency: currency,
  }).format(amount);
}

/**
 * Format quantity (handles decimals for weight-based items)
 */
function formatQuantity(quantity: number): string {
  // Show decimals only if needed
  if (Number.isInteger(quantity)) {
    return quantity.toLocaleString();
  }
  return quantity.toLocaleString(undefined, { maximumFractionDigits: 3 });
}

/**
 * Truncate long text with ellipsis
 */
function truncateText(text: string, maxLength: number = 35): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength - 1) + '…';
}

/**
 * OrderLineItem component - displays a single product line
 */
interface LineItemProps {
  item: OrderLineItemType;
  currency: string;
}

function OrderLineItem({ item, currency }: LineItemProps) {
  const lineTotal = item.quantity * item.unitPrice;
  const displayName = truncateText(item.name);
  const accessibilityLabel = `${item.name}, quantity ${formatQuantity(item.quantity)}, ${formatCurrency(lineTotal, currency)}`;

  return (
    <View
      style={styles.lineItem}
      accessible={true}
      accessibilityLabel={accessibilityLabel}
    >
      <View style={styles.lineItemLeft}>
        <Text style={styles.lineItemName} numberOfLines={1}>
          {displayName}
        </Text>
        <Text style={styles.lineItemQuantity}>
          x{formatQuantity(item.quantity)} @ {formatCurrency(item.unitPrice, currency)}
        </Text>
      </View>
      <Text style={styles.lineItemTotal}>
        {formatCurrency(lineTotal, currency)}
      </Text>
    </View>
  );
}

/**
 * CostBreakdownRow - a single row in the cost breakdown section
 */
interface BreakdownRowProps {
  label: string;
  amount: number;
  currency: string;
  isDiscount?: boolean;
  isBold?: boolean;
  accessibilityLabel?: string;
}

function CostBreakdownRow({
  label,
  amount,
  currency,
  isDiscount = false,
  isBold = false,
  accessibilityLabel,
}: BreakdownRowProps) {
  const displayAmount = isDiscount ? -Math.abs(amount) : amount;
  const formattedAmount = formatCurrency(Math.abs(amount), currency);
  const displayText = isDiscount ? `-${formattedAmount}` : formattedAmount;

  return (
    <View
      style={styles.breakdownRow}
      accessible={true}
      accessibilityLabel={accessibilityLabel || `${label}, ${displayText}`}
    >
      <Text style={[styles.breakdownLabel, isBold && styles.breakdownLabelBold]}>
        {label}
      </Text>
      <Text
        style={[
          styles.breakdownAmount,
          isDiscount && styles.breakdownAmountDiscount,
          isBold && styles.breakdownAmountBold,
        ]}
      >
        {displayText}
      </Text>
    </View>
  );
}

/**
 * Main OrderSummary component
 */
export function OrderSummary({ orderDetails, currency }: OrderSummaryProps) {
  const [showAllItems, setShowAllItems] = useState(false);

  const items = orderDetails.items || [];
  const hasMoreItems = items.length > INITIAL_ITEMS_VISIBLE;
  const visibleItems = showAllItems ? items : items.slice(0, INITIAL_ITEMS_VISIBLE);
  const hiddenItemCount = items.length - INITIAL_ITEMS_VISIBLE;

  // Check if we have any cost breakdown info to show
  const hasBreakdown =
    orderDetails.subtotal !== undefined ||
    orderDetails.shipping !== undefined ||
    orderDetails.tax !== undefined ||
    (orderDetails.discounts && orderDetails.discounts.length > 0) ||
    (orderDetails.fees && orderDetails.fees.length > 0);

  return (
    <View style={styles.container}>
      {/* Line Items Section */}
      {items.length > 0 && (
        <View style={styles.itemsSection}>
          <Text style={styles.sectionTitle}>Order Items</Text>

          {visibleItems.map((item, index) => (
            <OrderLineItem
              key={item.sku || `item-${index}`}
              item={item}
              currency={currency}
            />
          ))}

          {/* Show "View all" button if there are hidden items */}
          {hasMoreItems && !showAllItems && (
            <TouchableOpacity
              style={styles.viewAllButton}
              onPress={() => setShowAllItems(true)}
              accessibilityRole="button"
              accessibilityLabel={`View all ${items.length} items`}
            >
              <Text style={styles.viewAllText}>
                View all {items.length} items (+{hiddenItemCount} more)
              </Text>
            </TouchableOpacity>
          )}

          {/* Show "Show less" button if expanded */}
          {hasMoreItems && showAllItems && (
            <TouchableOpacity
              style={styles.viewAllButton}
              onPress={() => setShowAllItems(false)}
              accessibilityRole="button"
              accessibilityLabel="Show fewer items"
            >
              <Text style={styles.viewAllText}>Show fewer items</Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* Cost Breakdown Section */}
      {hasBreakdown && (
        <View style={styles.breakdownSection}>
          <View style={styles.breakdownDivider} />

          {/* Subtotal */}
          {orderDetails.subtotal !== undefined && (
            <CostBreakdownRow
              label="Subtotal"
              amount={orderDetails.subtotal}
              currency={currency}
            />
          )}

          {/* Shipping */}
          {orderDetails.shipping !== undefined && (
            <CostBreakdownRow
              label={
                orderDetails.shipping.method
                  ? `Shipping (${orderDetails.shipping.method})`
                  : 'Shipping'
              }
              amount={orderDetails.shipping.amount}
              currency={currency}
            />
          )}

          {/* Fees */}
          {orderDetails.fees?.map((fee, index) => (
            <CostBreakdownRow
              key={`fee-${index}`}
              label={fee.label}
              amount={fee.amount}
              currency={currency}
            />
          ))}

          {/* Tax */}
          {orderDetails.tax !== undefined && (
            <CostBreakdownRow
              label={
                orderDetails.tax.label
                  ? orderDetails.tax.rate
                    ? `${orderDetails.tax.label} (${(orderDetails.tax.rate * 100).toFixed(0)}%)`
                    : orderDetails.tax.label
                  : 'Tax'
              }
              amount={orderDetails.tax.amount}
              currency={currency}
            />
          )}

          {/* Discounts */}
          {orderDetails.discounts?.map((discount, index) => (
            <CostBreakdownRow
              key={`discount-${index}`}
              label={
                discount.code
                  ? `Promo: ${discount.code}`
                  : discount.description || 'Discount'
              }
              amount={discount.amount}
              currency={currency}
              isDiscount={true}
              accessibilityLabel={`Discount, ${discount.code || discount.description || 'applied'}, minus ${formatCurrency(discount.amount, currency)}`}
            />
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 16,
  },
  itemsSection: {
    paddingVertical: 8,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6b7280',
    marginBottom: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  lineItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingVertical: 10,
  },
  lineItemLeft: {
    flex: 1,
    marginRight: 12,
  },
  lineItemName: {
    fontSize: 16,
    color: '#111827',
    fontWeight: '500',
  },
  lineItemQuantity: {
    fontSize: 14,
    color: '#6b7280',
    marginTop: 2,
  },
  lineItemTotal: {
    fontSize: 16,
    fontWeight: '500',
    color: '#111827',
  },
  viewAllButton: {
    paddingVertical: 12,
    alignItems: 'center',
  },
  viewAllText: {
    fontSize: 14,
    color: '#3b82f6',
    fontWeight: '500',
  },
  breakdownSection: {
    paddingTop: 8,
  },
  breakdownDivider: {
    height: 1,
    backgroundColor: '#e5e7eb',
    marginBottom: 12,
  },
  breakdownRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
  },
  breakdownLabel: {
    fontSize: 14,
    color: '#6b7280',
  },
  breakdownLabelBold: {
    fontWeight: '600',
    color: '#111827',
  },
  breakdownAmount: {
    fontSize: 14,
    color: '#111827',
  },
  breakdownAmountDiscount: {
    color: '#22c55e',
  },
  breakdownAmountBold: {
    fontWeight: '600',
    fontSize: 16,
  },
});

export default OrderSummary;
