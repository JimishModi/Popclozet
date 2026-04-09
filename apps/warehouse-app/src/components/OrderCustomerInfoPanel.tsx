import { MapPin, Phone, Truck, User } from 'lucide-react';
import { type ManualAddressDetails } from '../services/addressDetails';

interface OrderCustomerInfoPanelProps {
    customerName?: string | null;
    customerPhone?: string | null;
    customerEmail?: string | null;
    fetchedAddress?: string | null;
    manualAddressDetails?: ManualAddressDetails | null;
    riderName?: string | null;
    riderPhone?: string | null;
}

export function OrderCustomerInfoPanel({
    customerName,
    customerPhone,
    customerEmail,
    fetchedAddress,
    manualAddressDetails,
    riderName,
    riderPhone,
}: OrderCustomerInfoPanelProps) {
    const recipientName = manualAddressDetails?.contactName || customerName || 'Not available';
    const recipientPhone = manualAddressDetails?.phoneNumber || customerPhone || null;

    return (
        <div className="mt-3 rounded-xl border border-surface-border bg-surface/80 p-3 space-y-3">
            <div className="space-y-2">
                <p className="text-[10px] font-bold uppercase tracking-wider text-warehouse-400">Delivery Information</p>

                <div className="flex items-start gap-2">
                    <User size={12} className="mt-0.5 text-zinc-500 shrink-0" />
                    <div className="min-w-0">
                        <p className="text-[9px] font-bold uppercase tracking-wider text-zinc-600">Name</p>
                        <p className="text-[11px] text-zinc-200 break-words">{recipientName}</p>
                        {manualAddressDetails?.contactName && customerName && manualAddressDetails.contactName !== customerName ? (
                            <p className="text-[10px] text-zinc-500 mt-1">Account: {customerName}</p>
                        ) : null}
                    </div>
                </div>

                <div className="flex items-start gap-2">
                    <Phone size={12} className="mt-0.5 text-zinc-500 shrink-0" />
                    <div className="min-w-0">
                        <p className="text-[9px] font-bold uppercase tracking-wider text-zinc-600">Phone</p>
                        {recipientPhone ? (
                            <a
                                href={`tel:${recipientPhone}`}
                                className="text-[11px] text-zinc-200 underline decoration-transparent hover:text-warehouse-300 hover:decoration-warehouse-300 transition-colors"
                            >
                                {recipientPhone}
                            </a>
                        ) : (
                            <p className="text-[11px] text-zinc-500">Not available</p>
                        )}
                        {manualAddressDetails?.phoneNumber && customerPhone && manualAddressDetails.phoneNumber !== customerPhone ? (
                            <p className="text-[10px] text-zinc-500 mt-1">Account: {customerPhone}</p>
                        ) : null}
                    </div>
                </div>

                {fetchedAddress ? (
                    <div className="flex items-start gap-2">
                        <MapPin size={12} className="mt-0.5 text-zinc-500 shrink-0" />
                        <div className="min-w-0">
                            <p className="text-[9px] font-bold uppercase tracking-wider text-zinc-600">Map Address</p>
                            <p className="text-[11px] text-zinc-300 break-words">{fetchedAddress}</p>
                        </div>
                    </div>
                ) : null}

                {manualAddressDetails ? (
                    <div className="flex items-start gap-2">
                        <MapPin size={12} className="mt-0.5 text-zinc-500 shrink-0" />
                        <div className="min-w-0">
                            <p className="text-[9px] font-bold uppercase tracking-wider text-zinc-600">Form Address</p>
                            <div className="text-[11px] text-zinc-200 space-y-0.5">
                                {manualAddressDetails.houseNumber ? (
                                    <p className="break-words"><span className="text-zinc-500">House: </span>{manualAddressDetails.houseNumber}</p>
                                ) : null}
                                {manualAddressDetails.streetAddress ? (
                                    <p className="break-words"><span className="text-zinc-500">Street: </span>{manualAddressDetails.streetAddress}</p>
                                ) : null}
                                {manualAddressDetails.landmark ? (
                                    <p className="break-words"><span className="text-zinc-500">Landmark: </span>{manualAddressDetails.landmark}</p>
                                ) : null}
                                {manualAddressDetails.city ? (
                                    <p className="break-words"><span className="text-zinc-500">City: </span>{manualAddressDetails.city}</p>
                                ) : null}
                                {manualAddressDetails.pincode ? (
                                    <p className="break-words"><span className="text-zinc-500">Pincode: </span>{manualAddressDetails.pincode}</p>
                                ) : null}
                            </div>
                        </div>
                    </div>
                ) : null}

                {customerEmail ? (
                    <div className="pl-5">
                        <p className="text-[10px] text-zinc-500 break-all">{customerEmail}</p>
                    </div>
                ) : null}
            </div>

            <div className="border-t border-surface-border pt-3 space-y-2">
                <p className="text-[10px] font-bold uppercase tracking-wider text-purple-400">Rider Details</p>
                <div className="flex items-start gap-2">
                    <Truck size={12} className="mt-0.5 text-zinc-500 shrink-0" />
                    <div className="min-w-0">
                        <p className="text-[11px] text-zinc-200">{riderName || 'Not assigned yet'}</p>
                        {riderPhone ? (
                            <a
                                href={`tel:${riderPhone}`}
                                className="text-[11px] text-zinc-400 underline decoration-transparent hover:text-purple-300 hover:decoration-purple-300 transition-colors"
                            >
                                {riderPhone}
                            </a>
                        ) : (
                            <p className="text-[11px] text-zinc-500 mt-1">Phone not available</p>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
