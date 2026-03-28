/**
 * ReceiptPDF — Client-side PDF receipt template
 * 
 * Uses @react-pdf/renderer to generate a branded popclozet receipt
 * entirely in the browser. Works offline when order data is in IndexedDB.
 */

import {
    Document,
    Page,
    Text,
    View,
    StyleSheet,
    Font,
} from "@react-pdf/renderer";
import type { ReceiptData } from "@/lib/db";

// Register a clean sans-serif font
Font.register({
    family: "Inter",
    fonts: [
        { src: "https://fonts.gstatic.com/s/inter/v18/UcCO3FwrK3iLTeHuS_nVMrMxCp50SjIw2boKoduKmMEVuLyfAZ9hjQ.woff2", fontWeight: 400 },
        { src: "https://fonts.gstatic.com/s/inter/v18/UcCO3FwrK3iLTeHuS_nVMrMxCp50SjIw2boKoduKmMEVuI6fAZ9hjQ.woff2", fontWeight: 600 },
        { src: "https://fonts.gstatic.com/s/inter/v18/UcCO3FwrK3iLTeHuS_nVMrMxCp50SjIw2boKoduKmMEVuFuYAZ9hjQ.woff2", fontWeight: 700 },
    ],
});

const styles = StyleSheet.create({
    page: {
        padding: 40,
        fontFamily: "Inter",
        fontSize: 10,
        color: "#1a1a1a",
        backgroundColor: "#ffffff",
    },

    // Header
    header: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "flex-start",
        marginBottom: 30,
        borderBottomWidth: 2,
        borderBottomColor: "#f2546d",
        paddingBottom: 20,
    },
    brandName: {
        fontSize: 24,
        fontWeight: 700,
        color: "#f2546d",
        letterSpacing: -0.5,
    },
    brandTagline: {
        fontSize: 9,
        color: "#666",
        marginTop: 4,
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

interface ReceiptPDFProps {
    data: ReceiptData;
}

export const ReceiptPDF = ({ data }: ReceiptPDFProps) => (
    <Document>
        <Page size="A4" style={styles.page}>
            {/* Header */}
            <View style={styles.header}>
                <View>
                    <Text style={styles.brandName}>popclozet</Text>
                    <Text style={styles.brandTagline}>
                        Rent the Trend • Delivered in 60 Minutes
                    </Text>
                </View>
                <View style={styles.companyInfo}>
                    <Text>popclozet Fashion Pvt. Ltd.</Text>
                    <Text>IIT Bombay, Powai</Text>
                    <Text>Mumbai, Maharashtra 400076</Text>
                    <Text>support@popclozet.com</Text>
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
                    <Text style={styles.colName}>{item.name}</Text>
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
                        ₹{(item.rentalPrice * item.quantity).toLocaleString("en-IN")}
                    </Text>
                </View>
            ))}

            {/* Totals */}
            <View style={styles.totalsSection}>
                <View style={styles.totalRow}>
                    <Text style={styles.totalLabel}>Subtotal</Text>
                    <Text style={styles.totalValue}>
                        ₹{data.subtotal.toLocaleString("en-IN")}
                    </Text>
                </View>
                <View style={styles.totalRow}>
                    <Text style={styles.totalLabel}>Delivery Fee</Text>
                    <Text style={styles.totalValue}>
                        {data.deliveryFee === 0
                            ? "FREE"
                            : `₹${data.deliveryFee.toLocaleString("en-IN")}`}
                    </Text>
                </View>
                <View style={styles.grandTotalRow}>
                    <Text style={styles.grandTotalLabel}>Total</Text>
                    <Text style={styles.grandTotalValue}>
                        ₹{data.total.toLocaleString("en-IN")}
                    </Text>
                </View>
            </View>

            {/* Delivery Address */}
            <View style={styles.addressSection}>
                <Text style={styles.addressLabel}>Delivery Address</Text>
                <Text style={styles.addressText}>{data.deliveryAddress}</Text>
            </View>

            {/* Footer */}
            <View style={styles.footer}>
                <Text style={styles.footerText}>
                    Thank you for renting with popclozet! This receipt was generated
                    on your device.
                </Text>
                <Text style={styles.footerBrand}>popclozet.com</Text>
            </View>
        </Page>
    </Document>
);

export default ReceiptPDF;
