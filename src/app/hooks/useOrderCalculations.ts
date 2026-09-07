import { useMemo } from 'react';
import type { ShoeEntry, Service } from '@/app/types';

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

    const parseDuration = (val: string | number | undefined): number => {
        if (val === undefined) return 0;
        if (typeof val === 'number') return val;
        if (val.includes('-')) {
            const parts = val.split('-').map(p => parseInt(p.trim(), 10)).filter(n => !isNaN(n));
            return parts.length > 0 ? Math.max(...parts) : 0;
        }
        const parsed = parseInt(val, 10);
        return isNaN(parsed) ? 0 : parsed;
    };

    const isRushEligible = useMemo(() => {
        if (shoes.length === 0) return false;
        return shoes.every(shoe => {
            const baseServicesArr = Array.isArray(shoe.baseService) ? shoe.baseService : [];
            const addOnsArr = Array.isArray(shoe.addOns) ? shoe.addOns : [];
            return baseServicesArr.length === 1 && baseServicesArr[0] === 'Basic Cleaning' && addOnsArr.length === 0;
        });
    }, [shoes]);

    const mlBreakdown = useMemo(() => {
        let baseDays = 0;
        let addOnDays = 0;
        let priorityDays = 0;

        let hasBasicCleaning = false;
        let hasMinorReglue = false;
        let hasFullReglue = false;
        let hasColorRenewal = false;
        let hasUnyellowing = false;
        let hasMinorRestoration = false;
        let hasMinorRetouch = false;

        shoes.forEach(shoe => {
            const baseServicesArr = Array.isArray(shoe.baseService) ? shoe.baseService : [];
            const addOnsArr = Array.isArray(shoe.addOns) ? shoe.addOns : [];

            if (baseServicesArr.includes('Basic Cleaning')) hasBasicCleaning = true;
            if (baseServicesArr.includes('Minor Reglue')) hasMinorReglue = true;
            if (baseServicesArr.includes('Full Reglue')) hasFullReglue = true;
            if (baseServicesArr.includes('Color Renewal')) hasColorRenewal = true;

            addOnsArr.forEach((a: any) => {
                const name = typeof a === 'string' ? a : (a.name || '');
                if (name === 'Unyellowing') hasUnyellowing = true;
                if (name === 'Minor Restoration') hasMinorRestoration = true;
                if (name === 'Minor Retouch') hasMinorRetouch = true;
            });
        });

        let overriddenDays: number | null = null;

        if (hasBasicCleaning) {
            if (hasColorRenewal || hasFullReglue) {
                overriddenDays = 25;
            } else if (hasMinorRestoration || hasMinorRetouch) {
                overriddenDays = 20;
            } else if (hasUnyellowing) {
                overriddenDays = 15;
            } else if (hasMinorReglue) {
                overriddenDays = 10;
            }
        } else if ((hasFullReglue || hasColorRenewal) && hasUnyellowing) {
            overriddenDays = 25;
        }

        if (overriddenDays !== null) {
            baseDays = overriddenDays;
            addOnDays = 0;
            priorityDays = 0;
        } else {
            shoes.forEach(shoe => {
                const servicesArr = Array.isArray(shoe.baseService) ? shoe.baseService : [];
                const hasDurationInclusive = servicesArr.some(s =>
                    s.toLowerCase().includes('reglue') || s.toLowerCase().includes('color renewal')
                );

                const filteredDurationServices = hasDurationInclusive
                    ? servicesArr.filter(s => s !== 'Basic Cleaning')
                    : servicesArr;

                filteredDurationServices.forEach((serviceName: string) => {
                    const service = baseServices.find(s => s.name === serviceName);
                    if (service && service.durationDays !== undefined) {
                        baseDays += parseDuration(service.durationDays);
                    } else if (serviceName === 'Basic Cleaning') {
                        baseDays += 10;
                    } else {
                        baseDays += 25;
                    }
                });

                const addOnsArr = Array.isArray(shoe.addOns) ? shoe.addOns : [];
                addOnsArr.forEach((addon: any) => {
                    const addonName = typeof addon === 'string' ? addon : (addon.name || '');
                    const addonQty = typeof addon === 'string' ? 1 : (addon.quantity || 1);
                    const addOnDetail = addOnServices.find(s => s.name === addonName);
                    if (addOnDetail && addOnDetail.durationDays !== undefined) {
                        addOnDays += parseDuration(addOnDetail.durationDays) * addonQty;
                    }
                });
            });

            if (priorityLevel === 'rush') {
                priorityDays = -(basicCleaningRushReduction);
            }
        }

        const safeShoes = Array.isArray(shoes) ? shoes : [];
        const hasServices = safeShoes.some(shoe => {
            const b = Array.isArray(shoe.baseService) ? shoe.baseService : [];
            const a = Array.isArray(shoe.addOns) ? shoe.addOns : [];
            return b.length > 0 || a.length > 0;
        });
        const totalDays = hasServices ? Math.max(1, baseDays + addOnDays + priorityDays) : 0;

        return { baseDays, addOnDays, priorityDays, totalDays };
    }, [shoes, baseServices, addOnServices, priorityLevel, basicCleaningRushReduction]);

    const getShoeTotal = (shoe: ShoeEntry) => {
        let total = 0;
        const servicesArr = Array.isArray(shoe.baseService) ? shoe.baseService : [];

        servicesArr.forEach((serviceName: string) => {
            const service = baseServices.find(s => s.name === serviceName);
            if (service) total += service.price;
        });

        const addOnsArr = Array.isArray(shoe.addOns) ? shoe.addOns : [];
        addOnsArr.forEach((addon: any) => {
            const addonName = typeof addon === 'string' ? addon : (addon.name || '');
            const addonQty = typeof addon === 'string' ? 1 : (addon.quantity || 1);
            total += getAddonTotal(addonName, addonQty);
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
