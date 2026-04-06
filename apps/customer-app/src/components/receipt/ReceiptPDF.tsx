/**
 * ReceiptPDF — Client-side PDF receipt template
 *
 * Uses @react-pdf/renderer to generate a branded Popclozet receipt
 * entirely in the browser. Works offline when order data is in IndexedDB.
 */

import {
    Document,
    Page,
    Text,
    View,
    Image,
    StyleSheet,
} from "@react-pdf/renderer";
import type { ReceiptData } from "@/lib/db";
import { POPCLOZET_LOGO_BASE64 } from "./logoData";

// Use Helvetica (built-in PDF font) — no external fetch needed, avoids CSP issues

const styles = StyleSheet.create({
    page: {
        padding: 40,
        fontFamily: "Helvetica",
        fontSize: 10,
        color: "#1a1a1a",
        backgroundColor: "#ffffff",
    },

    // Header
    header: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: 30,
        borderBottomWidth: 2,
        borderBottomColor: "#f2546d",
        paddingBottom: 20,
    },
    headerLeft: {
        flexDirection: "row",
        alignItems: "center",
        gap: 10,
    },
    logo: {
        width: 48,
        height: 48,
        objectFit: "contain" as any,
    },
    brandTextBlock: {
        justifyContent: "center",
    },
    brandName: {
        fontSize: 22,
        fontWeight: 700,
        color: "#f2546d",
        letterSpacing: -0.5,
    },
    brandTagline: {
        fontSize: 9,
        color: "#666",
        marginTop: 2,
    },
    companyInfo: {
        textAlign: "right",
        fontSize: 8,
        color: "#888",
        lineHeight: 1.6,
    },

    // Title
    receiptTitle: {
        fontSize: 14,
        fontWeight: 700,
        color: "#1a1a1a",
        marginBottom: 8,
        textTransform: "uppercase",
        letterSpacing: 1,
    },

    // Order info grid
    infoGrid: {
        flexDirection: "row",
        justifyContent: "space-between",
        marginBottom: 24,
        padding: 16,
        backgroundColor: "#fafafa",
        borderRadius: 6,
    },
    infoColumn: {
        flex: 1,
    },
    infoLabel: {
        fontSize: 8,
        fontWeight: 600,
        color: "#999",
        textTransform: "uppercase",
        letterSpacing: 0.5,
        marginBottom: 3,
    },
    infoValue: {
        fontSize: 10,
        fontWeight: 600,
        color: "#1a1a1a",
    },

    // Items table
    tableHeader: {
        flexDirection: "row",
        borderBottomWidth: 1,
        borderBottomColor: "#e0e0e0",
        paddingBottom: 8,
        marginBottom: 8,
    },
    tableHeaderText: {
        fontWeight: 700,
        fontSize: 8,
        color: "#888",
        textTransform: "uppercase",
        letterSpacing: 0.5,
    },
    tableRow: {
        flexDirection: "row",
        paddingVertical: 8,
        borderBottomWidth: 1,
        borderBottomColor: "#f5f5f5",
    },
    colName: { flex: 3 },
    colSize: { flex: 1, textAlign: "center" },
    colQty: { flex: 1, textAlign: "center" },
    colDays: { flex: 1, textAlign: "center" },
    colPrice: { flex: 1.5, textAlign: "right" },

    // Totals
    totalsSection: {
        marginTop: 16,
        paddingTop: 16,
        borderTopWidth: 2,
        borderTopColor: "#e0e0e0",
    },
    totalRow: {
        flexDirection: "row",
        justifyContent: "space-between",
        paddingVertical: 4,
    },
    totalLabel: {
        fontSize: 10,
        color: "#666",
    },
    totalValue: {
        fontSize: 10,
        fontWeight: 600,
        color: "#1a1a1a",
    },
    grandTotalRow: {
        flexDirection: "row",
        justifyContent: "space-between",
        paddingVertical: 10,
        marginTop: 8,
        borderTopWidth: 2,
        borderTopColor: "#f2546d",
    },
    grandTotalLabel: {
        fontSize: 14,
        fontWeight: 700,
        color: "#1a1a1a",
    },
    grandTotalValue: {
        fontSize: 14,
        fontWeight: 700,
        color: "#f2546d",
    },

    // Delivery address
    addressSection: {
        marginTop: 24,
        padding: 16,
        backgroundColor: "#fafafa",
        borderRadius: 6,
    },
    addressLabel: {
        fontSize: 8,
        fontWeight: 600,
        color: "#999",
        textTransform: "uppercase",
        letterSpacing: 0.5,
        marginBottom: 4,
    },
    addressText: {
        fontSize: 10,
        color: "#333",
        lineHeight: 1.5,
    },

    // Footer
    footer: {
        position: "absolute",
        bottom: 40,
        left: 40,
        right: 40,
        textAlign: "center",
        borderTopWidth: 1,
        borderTopColor: "#e0e0e0",
        paddingTop: 16,
    },
    footerText: {
        fontSize: 9,
        color: "#999",
        marginBottom: 4,
    },
    footerBrand: {
        fontSize: 10,
        fontWeight: 700,
        color: "#f2546d",
    },
});

function formatDate(dateStr: string): string {
    try {
        const d = new Date(dateStr);
        return d.toLocaleDateString("en-IN", {
            day: "2-digit",
            month: "short",
            year: "numeric",
        });
    } catch {
        return dateStr;
    }
}

function formatRupees(amount: number): string {
    return `Rs. ${amount.toLocaleString("en-IN")}`;
}

interface ReceiptPDFProps {
    data: ReceiptData;
}

export const ReceiptPDF = ({ data }: ReceiptPDFProps) => (
    <Document>
        <Page size="A4" style={styles.page}>
            {/* Header */}
            <View style={styles.header}>
                <View style={styles.headerLeft}>
                    <Image src={POPCLOZET_LOGO_BASE64} style={styles.logo} />
                    <View style={styles.brandTextBlock}>
                        <Text style={styles.brandName}>Popclozet</Text>
                        <Text style={styles.brandTagline}>Rent the Trend</Text>
                    </View>
                </View>
                <View style={styles.companyInfo}>
                    <Text>Popclozet Fashion Pvt. Ltd.</Text>
                    <Text>IIT Bombay, Powai</Text>
                    <Text>Mumbai, Maharashtra 400076</Text>
                    <Text>businessrep@popclozet.in</Text>
                </View>
            </View>

            {/* Receipt Title */}
            <Text style={styles.receiptTitle}>Rental Receipt</Text>

            {/* Order Info Grid */}
            <View style={styles.infoGrid}>
                <View style={styles.infoColumn}>
                    <Text style={styles.infoLabel}>Order ID</Text>
                    <Text style={styles.infoValue}>
                        #{data.orderId.slice(0, 8).toUpperCase()}
                    </Text>
                </View>
                <View style={styles.infoColumn}>
                    <Text style={styles.infoLabel}>Date</Text>
                    <Text style={styles.infoValue}>{formatDate(data.placedAt)}</Text>
                </View>
                <View style={styles.infoColumn}>
                    <Text style={styles.infoLabel}>Rental Period</Text>
                    <Text style={styles.infoValue}>
                        {formatDate(data.rentalStartDate)} –{" "}
                        {formatDate(data.rentalEndDate)}
                    </Text>
                </View>
            </View>

            {/* Items Table */}
            <View style={styles.tableHeader}>
                <Text style={[styles.tableHeaderText, styles.colName]}>Item</Text>
                <Text style={[styles.tableHeaderText, styles.colSize]}>Size</Text>
                <Text style={[styles.tableHeaderText, styles.colQty]}>Qty</Text>
                <Text style={[styles.tableHeaderText, styles.colDays]}>Days</Text>
                <Text style={[styles.tableHeaderText, styles.colPrice]}>Amount</Text>
            </View>

            {data.items.map((item, index) => (
                <View key={index} style={styles.tableRow}>
                    <View style={styles.colName}>
                        <Text>{item.name}</Text>
                        {item.brand ? (
                            <Text style={{ fontSize: 8, color: "#999", marginTop: 2 }}>
                                {item.brand}
                            </Text>
                        ) : null}
                    </View>
                    <Text style={[styles.colSize, { textAlign: "center" }]}>
                        {item.size}
                    </Text>
                    <Text style={[styles.colQty, { textAlign: "center" }]}>
                        {item.quantity}
                    </Text>
                    <Text style={[styles.colDays, { textAlign: "center" }]}>
                        {item.days}
                    </Text>
                    <Text style={[styles.colPrice, { textAlign: "right" }]}>
                        {formatRupees(item.rentalPrice * item.quantity)}
                    </Text>
                </View>
            ))}

            {/* Totals */}
            <View style={styles.totalsSection}>
                <View style={styles.totalRow}>
                    <Text style={styles.totalLabel}>Subtotal</Text>
                    <Text style={styles.totalValue}>
                        {formatRupees(data.subtotal)}
                    </Text>
                </View>
                {(data.discount ?? 0) > 0 && (
                    <View style={styles.totalRow}>
                        <Text style={styles.totalLabel}>Discount</Text>
                        <Text style={[styles.totalValue, { color: "#22c55e" }]}>
                            -{formatRupees(data.discount ?? 0)}
                        </Text>
                    </View>
                )}
                <View style={styles.totalRow}>
                    <Text style={styles.totalLabel}>Delivery Fee</Text>
                    <Text style={styles.totalValue}>
                        {data.deliveryFee === 0
                            ? "FREE"
                            : formatRupees(data.deliveryFee)}
                    </Text>
                </View>
                <View style={styles.grandTotalRow}>
                    <Text style={styles.grandTotalLabel}>Total Paid</Text>
                    <Text style={styles.grandTotalValue}>
                        {formatRupees(data.total)}
                    </Text>
                </View>
            </View>

            {/* Payment Method & Delivery Address */}
            <View style={{ flexDirection: "row", gap: 12, marginTop: 24 }}>
                {data.paymentMethod ? (
                    <View style={[styles.addressSection, { flex: 1, marginTop: 0 }]}>
                        <Text style={styles.addressLabel}>Payment Method</Text>
                        <Text style={[styles.addressText, { fontWeight: 600 }]}>
                            {data.paymentMethod.toUpperCase() === 'COD'
                                ? 'Cash on Delivery'
                                : data.paymentMethod.toUpperCase() === 'UPI'
                                    ? 'UPI (Online)'
                                    : data.paymentMethod.toUpperCase()}
                        </Text>
                    </View>
                ) : null}
                <View style={[styles.addressSection, { flex: 2, marginTop: 0 }]}>
                    <Text style={styles.addressLabel}>Delivery Address</Text>
                    <Text style={styles.addressText}>{data.deliveryAddress}</Text>
                </View>
            </View>

            {/* Footer */}
            <View style={styles.footer}>
                <Text style={styles.footerText}>
                    Thank you for renting with Popclozet!
                </Text>
                <Text style={styles.footerBrand}>popclozet.in</Text>
            </View>
        </Page>
    </Document>
);

export default ReceiptPDF;
