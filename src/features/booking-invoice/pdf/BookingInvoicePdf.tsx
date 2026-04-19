import { Document, Link, Page, Polygon, StyleSheet, Svg, Text, View } from "@react-pdf/renderer";
import { formatAud } from "#/features/booking-invoice/lib/money";
import type { BookingInvoiceData } from "#/features/booking-invoice/lib/types";
import { formatTimeValue } from "#/lib/bookingdatetime";

export interface BookingInvoicePdfProps {
	data: BookingInvoiceData;
}

export function BookingInvoicePdf({ data }: BookingInvoicePdfProps) {
	const formattedSessionTime = formatTimeValue(data.booking.time);

	return (
		<Document>
			<Page
				size="A4"
				style={styles.page}>
				<View style={styles.headerRow}>
					<View style={styles.logoWrap}>
						<VvPodcastLogo />
					</View>
					<View style={styles.headerRight}>
						<Text style={styles.invoiceTitle}>VV Podcast Studio Hire Invoice</Text>
						<Text style={styles.businessDetailStrong}>{data.branding.businessName}</Text>
						<Text style={styles.businessDetail}>{data.branding.contactEmail}</Text>
						<Text style={styles.businessDetail}>ABN: 97 592 829 541</Text>
						<Link
							src={data.branding.locationUrl}
							style={styles.locationLink}>
							{data.branding.locationAddress}
						</Link>
					</View>
				</View>

				<View style={styles.metaRow}>
					<View style={styles.billToColumn}>
						<Text style={styles.sectionLabel}>Bill to</Text>
						<Text style={styles.customerName}>{data.customer.name}</Text>
						<Text style={styles.metaText}>{data.customer.accountName}</Text>
						{data.customer.abn ? (
							<Text style={styles.metaText}>ABN: {data.customer.abn}</Text>
						) : null}
						<Text style={styles.metaText}>{data.customer.email}</Text>
						<Text style={styles.metaText}>{data.customer.phone}</Text>
					</View>

					<View style={styles.invoiceInfoColumn}>
						<View style={styles.infoRow}>
							<Text style={styles.infoLabel}>Invoice date:</Text>
							<Text style={styles.infoValue}>{data.invoice.invoiceDateLabel}</Text>
						</View>
						<View style={styles.infoRow}>
							<Text style={styles.infoLabel}>Booking number:</Text>
							<Text style={styles.infoValue}>{data.invoice.number}</Text>
						</View>
					</View>
				</View>

				<View style={styles.sessionSummaryRow}>
					<View style={styles.sessionSummaryItem}>
						<Text style={styles.sessionSummaryLabel}>Session</Text>
						<Text style={styles.sessionSummaryValue}>
							{data.booking.service} · {data.booking.duration} · {formattedSessionTime}
						</Text>
					</View>
					<View style={styles.sessionSummaryItemRight}>
						<Text style={styles.sessionSummaryLabel}>Booking date</Text>
						<Text style={styles.sessionSummaryValue}>{data.booking.bookingDateLabel}</Text>
					</View>
				</View>

				<View style={styles.table}>
					<View style={[styles.tableRow, styles.tableHeaderRow]}>
						<Text style={[styles.tableCell, styles.itemColumn, styles.tableHeaderText]}>Item</Text>
						<Text style={[styles.tableCell, styles.qtyColumn, styles.tableHeaderText]}>Qty</Text>
						<Text style={[styles.tableCell, styles.rateColumn, styles.tableHeaderText]}>Rate</Text>
						<Text style={[styles.tableCell, styles.amountColumn, styles.tableHeaderText]}>
							Amount
						</Text>
					</View>
					{data.lineItems.map((item, index) => (
						<View
							key={`${item.description}-${index}`}
							style={styles.tableRow}>
							<Text style={[styles.tableCell, styles.itemColumn]}>{item.description}</Text>
							<Text style={[styles.tableCell, styles.qtyColumn]}>{item.quantity}</Text>
							<Text style={[styles.tableCell, styles.rateColumn]}>{formatAud(item.rate)}</Text>
							<Text style={[styles.tableCell, styles.amountColumn]}>{formatAud(item.amount)}</Text>
						</View>
					))}
				</View>

				<View style={styles.totalsWrap}>
					<View style={styles.totalRow}>
						<Text style={styles.totalLabel}>Subtotal</Text>
						<Text style={styles.totalValue}>{formatAud(data.amounts.subtotalAmount)}</Text>
					</View>
					<View style={styles.totalRow}>
						<Text style={styles.totalLabel}>Deposit paid</Text>
						<Text style={styles.totalValue}>-{formatAud(data.amounts.depositAmount)}</Text>
					</View>
					<View style={styles.totalDueRow}>
						<Text style={styles.totalDueLabel}>Total due</Text>
						<Text style={styles.totalDueValue}>{formatAud(data.amounts.totalDueAmount)}</Text>
					</View>
					<Text style={styles.dueDateText}>Due: End of day on {data.invoice.dueDateLabel}</Text>
				</View>

				<View style={styles.paymentSection}>
					<View style={styles.paymentColumns}>
						<View style={styles.paymentInstructionsGroup}>
							<View style={styles.paymentNoteBlock}>
								<Text style={styles.paymentNoteHeading}>Payment method:</Text>
								<Text style={styles.paymentMethodText}>
									Settle early via Bank Transfer / PayID, or pay in-studio.
								</Text>
							</View>
							<Text style={styles.paymentHelperText}>
								*If transferring on the day, please email the receipt.
							</Text>
						</View>
						<View style={styles.paymentMethodsGroup}>
							<View style={styles.paymentMethodGroup}>
								<Text style={styles.paymentMethodHeading}>{data.payment.bankTransferLabel}</Text>
								<Text style={styles.paymentMethodText}>BSB: {data.payment.bsb}</Text>
								<Text style={styles.paymentMethodText}>Acc: {data.payment.accountNumber}</Text>
							</View>
							<View style={styles.paymentMethodGroupSpaced}>
								<Text style={styles.paymentMethodHeading}>{data.payment.payIdLabel}</Text>
								<Text style={styles.paymentMethodText}>{data.payment.payId}</Text>
							</View>
						</View>
					</View>
				</View>

				<View style={styles.notesSection}>
					<Text style={styles.cancellationLabel}>Cancellation Policy:</Text>
					<Text style={styles.notesText}>{data.notes.cancellationPolicy}</Text>
				</View>
			</Page>
		</Document>
	);
}

function VvPodcastLogo() {
	return (
		<Svg
			viewBox="0 0 2048 2048"
			style={styles.logo}>
			<Polygon
				fill="#f5c400"
				points="264,229 886,1287 934,1200 415,314 1875,314 1833,229"
			/>
			<Polygon
				fill="#f5c400"
				points="227,287 180,364 886,1558 1334,787 1236,787 885,1388"
			/>
			<Polygon
				fill="#f5c400"
				points="504,368 965,1150 1014,1066 655,454 1944,454 1901,368"
			/>
			<Polygon
				fill="#f5c400"
				points="148,415 100,493 886,1830 1491,786 1394,786 886,1660"
			/>
			<Polygon
				fill="#f5c400"
				points="1971,508 746,508 799,595 1821,595 1105,1830 1203,1830"
			/>
			<Polygon
				fill="#f5c400"
				points="1731,647 829,647 880,733 1581,734 947,1830 1047,1830"
			/>
		</Svg>
	);
}

const styles = StyleSheet.create({
	page: {
		backgroundColor: "#ffffff",
		color: "#111827",
		fontFamily: "Helvetica",
		fontSize: 10,
		paddingHorizontal: 34,
		paddingVertical: 32,
	},
	headerRow: {
		alignItems: "flex-start",
		borderBottomColor: "#d1d5db",
		borderBottomStyle: "solid",
		borderBottomWidth: 1,
		flexDirection: "row",
		justifyContent: "space-between",
		marginBottom: 18,
		paddingBottom: 14,
	},
	logoWrap: {
		marginLeft: -45,
		paddingTop: -40,
		width: 200,
	},
	logo: {
		height: 96,
		width: 174,
	},
	headerRight: {
		alignItems: "flex-end",
		maxWidth: 300,
	},
	invoiceTitle: {
		fontSize: 18,
		fontWeight: 700,
		marginBottom: 6,
		textAlign: "right",
	},
	businessDetailStrong: {
		fontSize: 10,
		fontWeight: 700,
		lineHeight: 1.3,
		textAlign: "right",
	},
	businessDetail: {
		color: "#374151",
		fontSize: 9,
		lineHeight: 1.3,
		textAlign: "right",
	},
	locationLink: {
		color: "#374151",
		fontSize: 9,
		lineHeight: 1.3,
		textAlign: "right",
		textDecoration: "none",
	},
	metaRow: {
		flexDirection: "row",
		justifyContent: "space-between",
		marginBottom: 14,
	},
	billToColumn: {
		maxWidth: 270,
		paddingRight: 16,
		width: "55%",
	},
	invoiceInfoColumn: {
		width: "40%",
	},
	sectionLabel: {
		fontSize: 9,
		fontWeight: 700,
		marginBottom: 5,
		textTransform: "uppercase",
	},
	customerName: {
		fontSize: 12,
		fontWeight: 700,
		lineHeight: 1.35,
		marginBottom: 2,
	},
	metaText: {
		color: "#374151",
		fontSize: 9,
		lineHeight: 1.35,
		marginBottom: 1,
	},
	infoRow: {
		flexDirection: "row",
		justifyContent: "space-between",
		marginBottom: 4,
	},
	infoLabel: {
		color: "#4b5563",
		fontSize: 9,
		fontWeight: 700,
	},
	infoValue: {
		fontSize: 9,
		maxWidth: 150,
		textAlign: "right",
	},
	sessionSummaryRow: {
		flexDirection: "row",
		justifyContent: "flex-start",
		marginBottom: 12,
		paddingTop: 16,
		paddingBottom: 2,
	},
	sessionSummaryItem: {
		paddingRight: 24,
	},
	sessionSummaryItemRight: {
		paddingRight: 0,
	},
	sessionSummaryLabel: {
		color: "#4b5563",
		fontSize: 9,
		fontWeight: 700,
		marginBottom: 2,
		textTransform: "uppercase",
	},
	sessionSummaryValue: {
		fontSize: 10,
		fontWeight: 700,
		lineHeight: 1.35,
	},
	table: {
		borderColor: "#d1d5db",
		borderStyle: "solid",
		borderWidth: 1,
		marginBottom: 12,
	},
	tableHeaderRow: {
		backgroundColor: "#f3f4f6",
	},
	tableRow: {
		borderBottomColor: "#e5e7eb",
		borderBottomStyle: "solid",
		borderBottomWidth: 1,
		flexDirection: "row",
		minHeight: 26,
	},
	tableCell: {
		fontSize: 8.5,
		paddingHorizontal: 8,
		paddingVertical: 6,
	},
	tableHeaderText: {
		fontWeight: 700,
	},
	itemColumn: {
		flexGrow: 1,
		width: "52%",
	},
	qtyColumn: {
		textAlign: "right",
		width: "12%",
	},
	rateColumn: {
		textAlign: "right",
		width: "18%",
	},
	amountColumn: {
		textAlign: "right",
		width: "18%",
	},
	totalsWrap: {
		alignSelf: "flex-end",
		marginBottom: 18,
		width: 226,
	},
	totalRow: {
		flexDirection: "row",
		justifyContent: "space-between",
		paddingVertical: 2,
	},
	totalLabel: {
		color: "#4b5563",
		fontSize: 9,
	},
	totalValue: {
		fontSize: 9,
		fontWeight: 700,
	},
	totalDueRow: {
		backgroundColor: "#111827",
		flexDirection: "row",
		justifyContent: "space-between",
		marginTop: 6,
		paddingHorizontal: 10,
		paddingVertical: 8,
	},
	totalDueLabel: {
		color: "#ffffff",
		fontSize: 12,
		fontWeight: 700,
		textTransform: "uppercase",
	},
	totalDueValue: {
		color: "#ffffff",
		fontSize: 12,
		fontWeight: 700,
	},
	dueDateText: {
		color: "#374151",
		fontSize: 8.5,
		lineHeight: 1.4,
		marginTop: 6,
		textAlign: "right",
	},
	paymentSection: {
		borderTopColor: "#d1d5db",
		borderTopStyle: "solid",
		borderTopWidth: 1,
		marginBottom: 14,
		paddingTop: 12,
	},
	paymentColumns: {
		alignItems: "flex-start",
		flexDirection: "row",
		justifyContent: "space-between",
	},
	paymentInstructionsGroup: {
		borderLeftColor: "#111827",
		borderLeftStyle: "solid",
		borderLeftWidth: 2,
		paddingLeft: 10,
		width: "44%",
	},
	paymentMethodsGroup: {
		width: "44%",
	},
	paymentMethodGroup: {
		width: "50%",
	},
	paymentMethodGroupSpaced: {
		marginTop: 10,
		width: "50%",
	},
	paymentMethodHeading: {
		fontSize: 11,
		fontWeight: 700,
		lineHeight: 1.3,
		marginBottom: 2,
	},
	paymentMethodText: {
		color: "#374151",
		fontSize: 9,
		lineHeight: 1.35,
	},
	paymentNoteBlock: {
		marginBottom: 6,
	},
	paymentNoteHeading: {
		fontSize: 10,
		fontWeight: 700,
		lineHeight: 1.3,
		marginBottom: 1,
	},
	paymentHelperText: {
		color: "#6b7280",
		fontSize: 8,
		fontStyle: "italic",
		lineHeight: 1.35,
	},
	notesSection: {
		borderTopColor: "#e5e7eb",
		borderTopStyle: "solid",
		borderTopWidth: 1,
		paddingTop: 10,
	},
	cancellationLabel: {
		color: "#374151",
		fontSize: 8,
		fontStyle: "italic",
		fontWeight: 700,
		lineHeight: 1.35,
		marginBottom: 1,
	},
	notesText: {
		color: "#6b7280",
		fontSize: 8,
		fontStyle: "italic",
		lineHeight: 1.4,
		marginBottom: 4,
	},
});
