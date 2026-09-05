import { CircleCheck, CircleX } from "lucide-react";
import { Tabs, TabsList, TabsTrigger } from "#/components/ui/tabs";

type PaymentStatusTabsProps = {
	disabled: boolean;
	isPaid: boolean;
	onMarkPaid: () => void;
	onMarkUnpaid: () => void;
};

export function PaymentStatusTabs({
	disabled,
	isPaid,
	onMarkPaid,
	onMarkUnpaid
}: PaymentStatusTabsProps) {
	return (
		<Tabs value={isPaid.toString()}>
			<TabsList className="w-full bg-background/60">
				<TabsTrigger
					value="false"
					className="hover:border-input hover:bg-input/30 hover:text-destructive hover:shadow-sm focus-visible:text-destructive disabled:opacity-100 data-[state=active]:text-destructive dark:hover:text-destructive dark:focus-visible:text-destructive dark:data-[state=active]:text-destructive"
					disabled={disabled || !isPaid}
					onClick={onMarkUnpaid}>
					<CircleX aria-hidden />
					Not Paid
				</TabsTrigger>
				<TabsTrigger
					value="true"
					className="hover:border-input hover:bg-input/30 hover:text-green hover:shadow-sm focus-visible:text-green disabled:opacity-100 data-[state=active]:text-green dark:hover:text-green dark:focus-visible:text-green dark:data-[state=active]:text-green"
					disabled={disabled || isPaid}
					onClick={onMarkPaid}>
					<CircleCheck aria-hidden />
					Paid
				</TabsTrigger>
			</TabsList>
		</Tabs>
	);
}
