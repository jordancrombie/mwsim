/**
 * OrderSummary component for displaying enhanced purchase information
 * on the payment approval screen.
 *
 * Shows line items, cost breakdown (subtotal, shipping, tax, fees, discounts),
 * with collapsible behavior for long order lists, styled in a card format.
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import type {
  OrderDetails,
  OrderLineItem as OrderLineItemType,
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
  if (Number.isInteger(quantity)) {
    return quantity.toLocaleString();
  }
  return quantity.toLocaleString(undefined, { maximumFractionDigits: 3 });
}

/**
 * Truncate long text with ellipsis
 */
function truncateText(text: string, maxLength: number = 32): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength - 1) + '…';
}

/**
 * OrderLineItem component - displays a single product line
 */
interface LineItemProps {
  item: OrderLineItemType;
  currency: string;
  isLast: boolean;
}

function OrderLineItem({ item, currency, isLast }: LineItemProps) {
  const lineTotal = item.quantity * item.unitPrice;
  const displayName = truncateText(item.name);
  const accessibilityLabel = `${item.name}, quantity ${formatQuantity(item.quantity)}, ${formatCurrency(lineTotal, currency)}`;

  return (
    <View
      style={[styles.lineItem, !isLast && styles.lineItemBorder]}
      accessible={true}
      accessibilityLabel={accessibilityLabel}
    >
      <View style={styles.lineItemLeft}>
        <Text style={styles.lineItemName} numberOfLines={1}>
          {displayName}
        </Text>
        <Text style={styles.lineItemQuantity}>
          Qty: {formatQuantity(item.quantity)} × {formatCurrency(item.unitPrice, currency)}
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
  isTotal?: boolean;
  accessibilityLabel?: string;
}

function CostBreakdownRow({
  label,
  amount,
  currency,
  isDiscount = false,
  isTotal = false,
  accessibilityLabel,
}: BreakdownRowProps) {
  const formattedAmount = formatCurrency(Math.abs(amount), currency);
  const displayText = isDiscount ? `-${formattedAmount}` : formattedAmount;

  return (
    <View
      style={[styles.breakdownRow, isTotal && styles.breakdownRowTotal]}
      accessible={true}
      accessibilityLabel={accessibilityLabel || `${label}, ${displayText}`}
    >
      <Text style={[styles.breakdownLabel, isTotal && styles.breakdownLabelTotal]}>
        {label}
      </Text>
      <Text
        style={[
          styles.breakdownAmount,
          isDiscount && styles.breakdownAmountDiscount,
          isTotal && styles.breakdownAmountTotal,
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
      {/* Items Card */}
      {items.length > 0 && (
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardIcon}>🛒</Text>
            <Text style={styles.cardTitle}>Order Items</Text>
            <Text style={styles.itemCount}>{items.length} {items.length === 1 ? 'item' : 'items'}</Text>
          </View>

          <View style={styles.itemsList}>
            {visibleItems.map((item, index) => (
              <OrderLineItem
                key={item.sku || `item-${index}`}
                item={item}
                currency={currency}
                isLast={index === visibleItems.length - 1 && !hasMoreItems}
              />
            ))}

            {/* View all / Show less toggle */}
            {hasMoreItems && (
              <TouchableOpacity
                style={styles.viewAllButton}
                onPress={() => setShowAllItems(!showAllItems)}
                accessibilityRole="button"
                accessibilityLabel={showAllItems ? 'Show fewer items' : `View all ${items.length} items`}
              >
                <Text style={styles.viewAllText}>
                  {showAllItems ? 'Show less' : `View all ${items.length} items`}
                </Text>
                <Text style={styles.viewAllIcon}>
                  {showAllItems ? '↑' : '↓'}
                </Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      )}

      {/* Cost Breakdown Card */}
      {hasBreakdown && (
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardIcon}>📋</Text>
            <Text style={styles.cardTitle}>Price Breakdown</Text>
          </View>

          <View style={styles.breakdownList}>
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
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 12,
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
    overflow: 'hidden',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: '#f8fafc',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  cardIcon: {
    fontSize: 16,
    marginRight: 8,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1e293b',
    flex: 1,
  },
  itemCount: {
    fontSize: 13,
    color: '#64748b',
    fontWeight: '500',
  },
  itemsList: {
    paddingHorizontal: 16,
  },
  lineItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
  },
  lineItemBorder: {
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  lineItemLeft: {
    flex: 1,
    marginRight: 12,
  },
  lineItemName: {
    fontSize: 15,
    color: '#1e293b',
    fontWeight: '500',
    marginBottom: 2,
  },
  lineItemQuantity: {
    fontSize: 13,
    color: '#64748b',
  },
  lineItemTotal: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1e293b',
  },
  viewAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    gap: 6,
  },
  viewAllText: {
    fontSize: 14,
    color: '#3b82f6',
    fontWeight: '600',
  },
  viewAllIcon: {
    fontSize: 12,
    color: '#3b82f6',
  },
  breakdownList: {
    paddingHorizontal: 16,
    paddingVertical: 4,
  },
  breakdownRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
  },
  breakdownRowTotal: {
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
    marginTop: 4,
    paddingTop: 14,
  },
  breakdownLabel: {
    fontSize: 14,
    color: '#64748b',
  },
  breakdownLabelTotal: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1e293b',
  },
  breakdownAmount: {
    fontSize: 14,
    color: '#1e293b',
    fontWeight: '500',
  },
  breakdownAmountDiscount: {
    color: '#16a34a',
    fontWeight: '600',
  },
  breakdownAmountTotal: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1e293b',
  },
});

export default OrderSummary;
