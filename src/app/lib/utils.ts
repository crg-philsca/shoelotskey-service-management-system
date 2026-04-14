export const formatPeso = (amount: number): string => {
    return new Intl.NumberFormat('en-PH', {
        style: 'currency',
        currency: 'PHP',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    }).format(amount);
};

export const formatReferenceNo = (value: string): string => {
    // Basic formatting for XXXX-XXXX-XXXX
    const cleaned = value.replace(/[^0-9A-Z]/gi, '').toUpperCase();
    const parts = [];
    for (let i = 0; i < cleaned.length; i += 4) {
        parts.push(cleaned.slice(i, i + 4));
    }
    return parts.join('-');
};
