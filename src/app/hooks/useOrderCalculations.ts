import { useMemo } from 'react';
import type { ShoeEntry, Service } from '@/app/types';
import { calculateOfficialReleaseBreakdown } from '@/app/lib/businessRules';

interface OrderCalculationParams {
    shoes: ShoeEntry[];
    services: Service[];
    priorityLevel: string;
    amountReceived?: string;
    paymentStatus?: string;
    basicCleaningRushReduction?: number;
}

export function useOrderCalculations({
    shoes,
    services,
    priorityLevel,
    amountReceived = '0',
    paymentStatus = 'pending',
    basicCleaningRushReduction = 9
}: OrderCalculationParams) {
    const activeServices = services.filter(s => s.active);
    const baseServices = activeServices.filter(s => s.category === 'base');
    const addOnServices = activeServices.filter(s => s.category === 'addon');

    const getAddonTotal = (addonName: string, quantity: number) => {
        const addon = addOnServices.find(s => s.name === addonName);
        if (!addon) return 0;
        return addon.price * quantity;
    };

    const isRushEligible = useMemo(() => {
        if (shoes.length === 0) return false;
        return shoes.every(shoe => {
            const baseServicesArr = Array.isArray(shoe.baseService) ? shoe.baseService : [];
            const addOnsArr = Array.isArray(shoe.addOns) ? shoe.addOns : [];
            return baseServicesArr.length === 1 && baseServicesArr[0] === 'Basic Cleaning' && addOnsArr.length === 0;
        });
    }, [shoes]);

    const catalogDurations = useMemo(() => {
        const map: Record<string, string | number> = {};
        [...baseServices, ...addOnServices].forEach((service) => {
            if (service.name && service.durationDays !== undefined) {
                map[service.name] = service.durationDays;
            }
        });
        return map;
    }, [baseServices, addOnServices]);

    const mlBreakdown = useMemo(
        () => calculateOfficialReleaseBreakdown(shoes, priorityLevel, basicCleaningRushReduction, catalogDurations),
        [shoes, priorityLevel, basicCleaningRushReduction, catalogDurations],
    );

    const getShoeTotal = (shoe: ShoeEntry) => {
        let total = 0;
        const servicesArr = Array.isArray(shoe.baseService) ? shoe.baseService : [];

        servicesArr.forEach((serviceName: string) => {
            const historicalBase = shoe.historicalBasePrices?.find(h => h.name === serviceName);
            if (historicalBase) {
                total += historicalBase.price;
            } else {
                const service = baseServices.find(s => s.name === serviceName);
                if (service) total += service.price;
            }
        });

        const addOnsArr = Array.isArray(shoe.addOns) ? shoe.addOns : [];
        addOnsArr.forEach((addon: any) => {
            const addonName = typeof addon === 'string' ? addon : (addon.name || '');
            const addonQty = typeof addon === 'string' ? 1 : (addon.quantity || 1);
            
            const historicalAddOn = shoe.historicalAddOnPrices?.find(h => h.name === addonName);
            if (historicalAddOn) {
                total += historicalAddOn.price * addonQty;
            } else {
                total += getAddonTotal(addonName, addonQty);
            }
        });

        if (priorityLevel === 'rush' && servicesArr.includes('Basic Cleaning')) {
            total += 150;
        }

        return total * (shoe.quantity || 1);
    };

    const totals = useMemo(() => {
        let baseTotal = 0;
        let addOnsTotal = 0;
        let rushFee = 0;

        shoes.forEach((shoe: ShoeEntry) => {
            const servicesArr = Array.isArray(shoe.baseService) ? shoe.baseService : [];
            const shoeQty = shoe.quantity || 1;

            servicesArr.forEach((serviceName: string) => {
                const historicalBase = shoe.historicalBasePrices?.find(h => h.name === serviceName);
                if (historicalBase) {
                    baseTotal += historicalBase.price * shoeQty;
                } else {
                    const service = baseServices.find(s => s.name === serviceName);
                    if (service) {
                        baseTotal += service.price * shoeQty;
                    }
                }
            });

            const addOnsArr = Array.isArray(shoe.addOns) ? shoe.addOns : [];
            addOnsArr.forEach((addon: any) => {
                const addonName = typeof addon === 'string' ? addon : (addon.name || '');
                const addonQty = typeof addon === 'string' ? 1 : (addon.quantity || 1);
                
                const historicalAddOn = shoe.historicalAddOnPrices?.find(h => h.name === addonName);
                if (historicalAddOn) {
                    addOnsTotal += (historicalAddOn.price * addonQty) * shoeQty;
                } else {
                    addOnsTotal += getAddonTotal(addonName, addonQty) * shoeQty;
                }
            });

            if (priorityLevel === 'rush' && servicesArr.includes('Basic Cleaning')) {
                rushFee += 150 * shoeQty;
            }
        });

        const grandTotal = baseTotal + addOnsTotal + rushFee;
        const amountReceivedNum = amountReceived ? parseFloat(amountReceived.replace(/,/g, '')) : 0;

        const depositAmt = paymentStatus === 'downpayment' ? grandTotal / 2 : grandTotal;
        const change = amountReceivedNum - depositAmt;
        const remainingBalance = Math.max(0, grandTotal - depositAmt);

        return { baseTotal, addOnsTotal, rushFee, grandTotal, amountReceivedNum, remainingBalance, change };
    }, [shoes, baseServices, addOnServices, priorityLevel, amountReceived, paymentStatus]);

    const calculatePredictedDays = () => {
        const hasServices = shoes.some(shoe => {
            const b = Array.isArray(shoe.baseService) ? shoe.baseService : [];
            const a = Array.isArray(shoe.addOns) ? shoe.addOns : [];
            return b.length > 0 || a.length > 0;
        });
        if (!hasServices) return 0;
        return mlBreakdown.totalDays;
    };

    const getAvailableAddOnsForService = (serviceName: string) => {
        const allowedAddOns = [
            { base: 'Basic Cleaning', addOn: 'White Paint' },
            { base: 'Basic Cleaning', addOn: 'Unyellowing' },
            { base: 'Basic Cleaning', addOn: 'Minor Retouch' },
            { base: 'Basic Cleaning', addOn: 'Minor Restoration' },
            { base: 'Full Reglue', addOn: 'White Paint' },
            { base: 'Full Reglue', addOn: 'Unyellowing' },
            { base: 'Minor Reglue', addOn: 'White Paint' },
            { base: 'Minor Reglue', addOn: 'Unyellowing' },
        ];
        return allowedAddOns.filter(m => m.base === serviceName).map(m => m.addOn);
    };

    return {
        isRushEligible,
        mlBreakdown,
        calculatePredictedDays,
        getShoeTotal,
        getAddonTotal,
        totals,
        getAvailableAddOnsForService,
        activeServices,
        baseServices,
        addOnServices
    };
}
