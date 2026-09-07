import { useState, useEffect } from 'react';
import { 
  Box, Typography, Paper, Grid, Button, IconButton, 
  Divider, TextField, Card, CircularProgress, Alert, MenuItem, InputAdornment, Chip
} from '@mui/material';
import { CheckCircle, Cancel, Edit, ArrowBack, Refresh } from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';

const API_BASE_URL = 'http://localhost:8000/api';

export default function HistoricalValidationQueue() {
  const [queue, setQueue] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [editMode, setEditMode] = useState(false);
  const [editedData, setEditedData] = useState<any>(null);
  
  const navigate = useNavigate();

  const fetchQueue = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/historical/processing/queue?limit=10`);
      if (!response.ok) throw new Error('Failed to fetch queue');
      const data = await response.json();
      setQueue(data);
      setCurrentIndex(0);
      setEditMode(false);
    } catch (error) {
      console.error("Failed to fetch queue", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchQueue();
  }, []);

  const expandServiceName = (svcString: string) => {
    let name = svcString;
    name = name.replace(/^BC\b/, 'Basic Cleaning (BC)');
    name = name.replace(/^MRET\b/, 'Minor Retouch (MRET)');
    name = name.replace(/^MR\b/, 'Minor Reglue (MR)');
    name = name.replace(/^MRES\b/, 'Minor Restoration (MRES)');
    name = name.replace(/^FR\b/, 'Full Reglue (FR)');
    name = name.replace(/^UY\b/, 'Unyellowing (UY)');
    name = name.replace(/^CR\b/, 'Color Renewal (CR)');
    
    // Remove (₱0.00) if the backend appended it
    name = name.replace(/\s*\(₱0\.00\)$/, '');
    
    return name;
  };

  const formatNumber = (val: any) => {
    if (val === undefined || val === null || val === '') return '0.00';
    const num = Number(val);
    return isNaN(num) ? '0.00' : num.toFixed(2);
  };

  const handleAction = async (action: 'approve' | 'reject' | 'correct') => {
    if (queue.length === 0) return;
    const currentImg = queue[currentIndex];
    
    try {
      const endpoint = currentImg.historical_image_id
        ? `${API_BASE_URL}/historical/processing/validate/${currentImg.historical_image_id}`
        : `${API_BASE_URL}/historical/processing/validate-order/${currentImg.order.historical_order_id}`;

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action,
          corrections: action === 'correct' ? editedData : undefined
        })
      });
      if (!res.ok) throw new Error('Failed to validate record');
      
      // Move to next in queue
      if (currentIndex < queue.length - 1) {
        setCurrentIndex(currentIndex + 1);
        setEditMode(false);
      } else {
        // Fetch more
        fetchQueue();
      }
    } catch (error: any) {
      console.error(`Failed to ${action} record`, error);
      alert(`Failed to save corrections: ${error.message || 'Server Error'}`);
    }
  };

  const handleEditChange = (field: string, value: any) => {
    setEditedData((prev: any) => {
      const newData = { ...prev, [field]: value };
      
      // Auto-calculate balance if grand_total or downpayment changes
      if (field === 'grand_total' || field === 'downpayment') {
         const gt = parseFloat(newData.grand_total) || 0;
         const dp = parseFloat(newData.downpayment) || 0;
         newData.balance = (gt - dp).toFixed(2);
      }
      return newData;
    });
  };

  const handleEditItem = (idx: number, field: string, value: any) => {
    setEditedData((prev: any) => {
      const newItems = [...(prev.items || [])];
      newItems[idx] = { ...newItems[idx], [field]: value };
      return { ...prev, items: newItems };
    });
  };

  const startEdit = () => {
    const orderCopy = { ...queue[currentIndex]?.order };
    
    // Default payment method to Cash
    if (!orderCopy.payment_method) {
      orderCopy.payment_method = 'Cash';
    }
    
    // Default downpayment to half of grand total if not set or 0
    if ((!orderCopy.downpayment || orderCopy.downpayment === 0) && orderCopy.grand_total > 0) {
      orderCopy.downpayment = parseFloat((orderCopy.grand_total / 2).toFixed(2));
      orderCopy.balance = parseFloat((orderCopy.grand_total - orderCopy.downpayment).toFixed(2));
    }

    setEditedData(orderCopy);
    setEditMode(true);
  };

  if (loading) return (
    <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%', minHeight: 400 }}>
      <CircularProgress color="error" />
    </Box>
  );

  if (queue.length === 0) {
    return (
      <Box sx={{ p: 4, textAlign: 'center' }}>
        <CheckCircle color="success" sx={{ fontSize: 60, mb: 2 }} />
        <Typography variant="h5" gutterBottom>Validation Queue Empty</Typography>
        <Typography color="textSecondary" sx={{ mb: 3 }}>All historical records have been successfully validated.</Typography>
        <Button variant="contained" startIcon={<ArrowBack />} onClick={() => navigate('/job-order-form/historical-records')}>
          Return to Historical Records
        </Button>
      </Box>
    );
  }

  const currentItem = queue[currentIndex];

  return (
    <Box sx={{ p: 3, height: 'calc(100vh - 100px)', display: 'flex', flexDirection: 'column' }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <IconButton onClick={() => navigate('/job-order-form/historical-records')}><ArrowBack /></IconButton>
          <Typography variant="h5">Needs Human Review ({currentIndex + 1} of {queue.length})</Typography>
        </Box>
        <Button variant="outlined" startIcon={<Refresh />} onClick={fetchQueue}>Refresh Queue</Button>
      </Box>

      <Grid container spacing={3} sx={{ flex: 1, minHeight: 0 }}>
        {/* Left Side: Original Document (45%) */}
        <Grid size={{ xs: 12, md: 5.4 }} sx={{ display: 'flex', flexDirection: 'column', height: { xs: '50vh', md: '100%' } }}>
          <Paper variant="outlined" sx={{ flex: 1, p: 2, display: 'flex', flexDirection: 'column', bgcolor: 'grey.50' }}>
            <Typography variant="subtitle1" fontWeight="bold">Original Scanned Document</Typography>
            <Typography variant="body2" color="textSecondary" sx={{ mb: 1 }}>{currentItem.image_filename}</Typography>
            <Box sx={{ flex: 1, position: 'relative', bgcolor: 'white', border: '1px solid #e0e0e0', borderRadius: 1, overflowY: 'auto' }}>
              <img 
                src={`${API_BASE_URL}/historical/image/${currentItem.image_filename}`} 
                alt="Receipt" 
                style={{ width: '100%', objectFit: 'contain', objectPosition: 'top' }}
                onError={(e) => { (e.target as HTMLImageElement).src = 'https://via.placeholder.com/800x1200?text=Image+Not+Found'; }}
              />
            </Box>
          </Paper>
        </Grid>

        {/* Right Side: Extracted Data (55%) */}
        <Grid size={{ xs: 12, md: 6.6 }} sx={{ display: 'flex', flexDirection: 'column', height: { xs: 'auto', md: '100%' } }}>
          <Paper variant="outlined" sx={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <Box sx={{ p: 1.5, bgcolor: 'primary.main', color: 'primary.contrastText', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Typography variant="subtitle1" fontWeight="bold">Extracted Data</Typography>
              <Typography variant="body2">Confidence: {(currentItem.ocr_confidence * 100).toFixed(1)}%</Typography>
            </Box>

            <Box sx={{ p: 2, flex: 1, overflowY: 'auto' }}>
              {currentItem.missing_fields?.length > 0 && (
                <Alert severity="warning" sx={{ mb: 2, py: 0 }}>
                  <Typography variant="body2">⚠ Low OCR confidence detected. Please verify customer name and totals carefully.</Typography>
                </Alert>
              )}

              <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1, textTransform: 'uppercase', fontWeight: 'bold' }}>Customer Information</Typography>
              <Grid container spacing={1} sx={{ mb: 3 }}>
                <Grid size={{ xs: 6, sm: 4 }}>
                  <TextField 
                    fullWidth size="small"
                    label="Order ID" 
                    value={editMode ? editedData?.order_id : currentItem.order?.order_id} 
                    onChange={(e) => handleEditChange('order_id', e.target.value)}
                    InputProps={{ readOnly: !editMode }}
                    variant={editMode ? "outlined" : "filled"}
                  />
                </Grid>
                <Grid size={{ xs: 6, sm: 4 }}>
                  <TextField 
                    fullWidth size="small"
                    label="Branch" 
                    value={editMode ? editedData?.branch : currentItem.order?.branch} 
                    onChange={(e) => handleEditChange('branch', e.target.value)}
                    InputProps={{ readOnly: !editMode }}
                    variant={editMode ? "outlined" : "filled"}
                  />
                </Grid>
                <Grid size={{ xs: 12, sm: 4 }}>
                  <TextField 
                    fullWidth size="small"
                    label="Date Received" 
                    value={editMode ? editedData?.date_received : currentItem.order?.date_received?.split('T')[0]} 
                    onChange={(e) => handleEditChange('date_received', e.target.value)}
                    InputProps={{ readOnly: !editMode }}
                    variant={editMode ? "outlined" : "filled"}
                  />
                </Grid>
                <Grid size={{ xs: 12, sm: 8 }}>
                  <TextField 
                    fullWidth size="small"
                    label="Customer Name" 
                    value={editMode ? editedData?.customer?.name : currentItem.order?.customer?.name} 
                    onChange={(e) => handleEditChange('customer', { ...editedData?.customer, name: e.target.value })}
                    InputProps={{ readOnly: !editMode }}
                    variant={editMode ? "outlined" : "filled"}
                  />
                </Grid>
                <Grid size={{ xs: 12, sm: 4 }}>
                  <TextField 
                    fullWidth size="small"
                    label="Contact Number" 
                    value={editMode ? editedData?.customer?.contact : currentItem.order?.customer?.contact} 
                    onChange={(e) => handleEditChange('customer', { ...editedData?.customer, contact: e.target.value })}
                    InputProps={{ readOnly: !editMode }}
                    variant={editMode ? "outlined" : "filled"}
                  />
                </Grid>
              </Grid>

              <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1, textTransform: 'uppercase', fontWeight: 'bold' }}>Extracted Items ({((editMode ? editedData?.items : currentItem.order?.items) || []).length})</Typography>
              <Grid container spacing={2}>
              {((editMode ? editedData?.items : currentItem.order?.items) || []).map((item: any, idx: number) => (
                <Grid size={{ xs: 12, md: 6 }} key={idx}>
                <Card variant="outlined" sx={{ p: 1.5, display: 'flex', flexDirection: 'column', gap: 1.5, height: '100%' }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #e0e0e0', pb: 0.5 }}>
                    <Typography variant="subtitle2" fontWeight="bold">ITEM {idx + 1}</Typography>
                  </Box>
                  
                  {editMode ? (
                    <Grid container spacing={1}>
                       <Grid size={{ xs: 6 }}><TextField label="Brand" value={item.brand || ''} onChange={e => handleEditItem(idx, 'brand', e.target.value)} size="small" fullWidth variant="outlined" /></Grid>
                       <Grid size={{ xs: 6 }}><TextField label="Model" value={item.model || ''} onChange={e => handleEditItem(idx, 'model', e.target.value)} size="small" fullWidth variant="outlined" /></Grid>
                       <Grid size={{ xs: 6 }}><TextField label="Material" value={item.material || ''} onChange={e => handleEditItem(idx, 'material', e.target.value)} size="small" fullWidth variant="outlined" /></Grid>
                       <Grid size={{ xs: 6 }}><TextField label="Color" value={item.color || ''} onChange={e => handleEditItem(idx, 'color', e.target.value)} size="small" fullWidth variant="outlined" /></Grid>
                       <Grid size={{ xs: 6 }}><TextField label="Size" value={item.size || ''} onChange={e => handleEditItem(idx, 'size', e.target.value)} size="small" fullWidth variant="outlined" /></Grid>
                       <Grid size={{ xs: 6 }}>
                         <TextField 
                           label="Item Price" 
                           type="number"
                           value={item.item_price || ''} 
                           onChange={e => handleEditItem(idx, 'item_price', e.target.value)} 
                           size="small" 
                           fullWidth 
                           variant="outlined"
                           InputProps={{ startAdornment: <InputAdornment position="start">₱</InputAdornment> }}
                         />
                       </Grid>
                       <Grid size={{ xs: 12 }}><TextField label="Base Services (comma separated)" value={Array.isArray(item.base_services) ? item.base_services.join(', ') : item.base_services || ''} onChange={e => handleEditItem(idx, 'base_services', e.target.value.split(',').map((s: string) => s.trim()))} size="small" fullWidth variant="outlined" /></Grid>
                       <Grid size={{ xs: 12 }}><TextField label="Add-on Services (comma separated)" value={Array.isArray(item.addon_services) ? item.addon_services.join(', ') : item.addon_services || ''} onChange={e => handleEditItem(idx, 'addon_services', e.target.value.split(',').map((s: string) => s.trim()))} size="small" fullWidth variant="outlined" /></Grid>
                       <Grid size={{ xs: 12 }}><TextField label="Conditions (comma separated)" value={Array.isArray(item.conditions) ? item.conditions.join(', ') : item.conditions || ''} onChange={e => handleEditItem(idx, 'conditions', e.target.value.split(',').map((s: string) => s.trim()))} size="small" fullWidth variant="outlined" /></Grid>
                    </Grid>
                  ) : (
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, flex: 1 }}>
                      {/* Item Details Block */}
                      <Box sx={{ display: 'grid', gridTemplateColumns: '100px 1fr', rowGap: 0.5, columnGap: 1 }}>
                        {item.brand && (
                          <>
                            <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 'bold', textTransform: 'uppercase' }}>Brand</Typography>
                            <Typography variant="body2" fontWeight="bold" sx={{ color: 'text.primary', overflowWrap: 'anywhere', wordBreak: 'break-word' }}>{item.brand}</Typography>
                          </>
                        )}
                        {/* Combine Model and Color if exact match */}
                        {(item.model && item.color && item.model === item.color) ? (
                          <>
                            <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 'bold', textTransform: 'uppercase' }}>Model / Color</Typography>
                            <Typography variant="body2" fontWeight="bold" sx={{ color: 'text.primary', overflowWrap: 'anywhere', wordBreak: 'break-word' }}>{item.model}</Typography>
                          </>
                        ) : (
                          <>
                            {item.model && (
                              <>
                                <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 'bold', textTransform: 'uppercase' }}>Model</Typography>
                                <Typography variant="body2" fontWeight="bold" sx={{ color: 'text.primary', overflowWrap: 'anywhere', wordBreak: 'break-word' }}>{item.model}</Typography>
                              </>
                            )}
                            {item.color && (
                              <>
                                <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 'bold', textTransform: 'uppercase' }}>Color</Typography>
                                <Typography variant="body2" fontWeight="bold" sx={{ color: 'text.primary', overflowWrap: 'anywhere', wordBreak: 'break-word' }}>{item.color}</Typography>
                              </>
                            )}
                          </>
                        )}
                        {item.material && (
                          <>
                            <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 'bold', textTransform: 'uppercase' }}>Material</Typography>
                            <Typography variant="body2" fontWeight="bold" sx={{ color: 'text.primary', overflowWrap: 'anywhere', wordBreak: 'break-word' }}>{item.material}</Typography>
                          </>
                        )}
                        {item.size && (
                          <>
                            <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 'bold', textTransform: 'uppercase' }}>Size</Typography>
                            <Typography variant="body2" fontWeight="bold" sx={{ color: 'text.primary', overflowWrap: 'anywhere', wordBreak: 'break-word' }}>{item.size}</Typography>
                          </>
                        )}
                      </Box>

                      {/* Services Blocks */}
                      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                        {(item.base_services?.length > 0) && (
                          <Box>
                            <Typography variant="overline" color="text.secondary" fontWeight="bold" sx={{ lineHeight: 1.2 }}>BASE SERVICE</Typography>
                            <Typography variant="body2" color="text.primary">
                              {item.base_services.map(expandServiceName).join(', ')}
                            </Typography>
                          </Box>
                        )}
                        
                        {(item.addon_services?.length > 0) && (
                          <Box>
                            <Typography variant="overline" color="text.secondary" fontWeight="bold" sx={{ lineHeight: 1.2 }}>ADD-ONS</Typography>
                            <Typography variant="body2" color="text.primary">
                              {item.addon_services.map(expandServiceName).join(', ')}
                            </Typography>
                          </Box>
                        )}
                      </Box>

                      {/* Conditions Block */}
                      {item.conditions && item.conditions.length > 0 && (
                        <Box>
                          <Typography variant="overline" color="text.secondary" fontWeight="bold" sx={{ lineHeight: 1.2 }}>CONDITIONS</Typography>
                          <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', mt: 0.5 }}>
                            {item.conditions.map((cond: string, cIdx: number) => (
                              <Chip key={cIdx} label={cond} size="small" variant="outlined" />
                            ))}
                          </Box>
                        </Box>
                      )}

                      <Box sx={{ mt: 'auto', pt: 1 }}>
                          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', bgcolor: 'grey.100', p: 1, borderRadius: 1 }}>
                            <Typography variant="body2" sx={{ color: 'text.secondary', fontWeight: 'bold', fontSize: '0.7rem' }}>PRICE PER ITEM OR BASE SERVICE + ADD-ON TOTAL PRICE</Typography>
                            <Typography variant="body2" fontWeight="bold">₱{formatNumber(item.item_price)}</Typography>
                          </Box>
                      </Box>
                    </Box>
                  )}
                </Card>
                </Grid>
              ))}
              </Grid>

              <Typography variant="subtitle2" color="text.secondary" sx={{ mt: 3, mb: 1, textTransform: 'uppercase', fontWeight: 'bold' }}>Order Totals & Payment</Typography>
              
              {/* COMPUTE DISCREPANCY */}
              {(() => {
                const itemsToSum = (editMode ? editedData?.items : currentItem.order?.items) || [];
                const calculatedTotal = itemsToSum.reduce((acc: number, item: any) => acc + (parseFloat(item.item_price) || 0), 0);
                const recordedTotal = editMode ? (parseFloat(editedData?.grand_total) || 0) : (parseFloat(currentItem.order?.grand_total) || 0);
                const hasDiscrepancy = calculatedTotal > 0 && calculatedTotal !== recordedTotal;
                
                const recordedDownpayment = editMode ? (parseFloat(editedData?.downpayment) || 0) : (parseFloat(currentItem.order?.downpayment) || 0);
                const recordedBalance = editMode ? (parseFloat(editedData?.balance) || 0) : (parseFloat(currentItem.order?.balance) || 0);
                
                const calculatedBalance = recordedTotal - recordedDownpayment;
                const hasPaymentDiscrepancy = calculatedBalance !== recordedBalance;
                
                return (
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <Box sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 1, overflow: 'hidden', display: 'flex', flexWrap: 'wrap' }}>
                      <Box sx={{ flex: 1, p: 1.5, minWidth: '120px', borderRight: '1px solid', borderColor: 'divider', bgcolor: 'primary.main', color: 'primary.contrastText' }}>
                        <Typography variant="caption" sx={{ opacity: 0.8 }}>GRAND TOTAL</Typography>
                        <Typography variant="subtitle1" fontWeight="bold">₱{formatNumber(recordedTotal)}</Typography>
                      </Box>
                      <Box sx={{ flex: 1, p: 1.5, minWidth: '120px', borderRight: '1px solid', borderColor: 'divider', bgcolor: 'grey.100' }}>
                        <Typography variant="caption" sx={{ color: 'text.secondary' }}>DOWNPAYMENT</Typography>
                        <Typography variant="subtitle1" fontWeight="bold">₱{formatNumber(recordedDownpayment)}</Typography>
                      </Box>
                      <Box sx={{ flex: 1, p: 1.5, minWidth: '120px', borderRight: '1px solid', borderColor: 'divider', bgcolor: 'grey.100' }}>
                        <Typography variant="caption" sx={{ color: 'text.secondary' }}>BALANCE</Typography>
                        <Typography variant="subtitle1" fontWeight="bold">₱{formatNumber(recordedBalance)}</Typography>
                      </Box>
                      <Box sx={{ flex: 1, p: 1.5, minWidth: '120px', bgcolor: 'grey.100' }}>
                        <Typography variant="caption" sx={{ color: 'text.secondary' }}>PAYMENT METHOD</Typography>
                        <Typography variant="subtitle1" fontWeight="bold">{editMode ? (editedData?.payment_method || 'Cash') : (currentItem.order?.payment_method || 'Cash')}</Typography>
                      </Box>
                    </Box>
                    
                    {(hasDiscrepancy || hasPaymentDiscrepancy) && (
                      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                        {hasDiscrepancy && (
                          <Alert severity="warning" sx={{ py: 0, px: 2 }}>
                            <Typography variant="body2">
                              <strong>Amount discrepancy:</strong> Calculated item total (₱{formatNumber(calculatedTotal)}) ≠ Recorded grand total (₱{formatNumber(recordedTotal)}). Please verify against original document.
                            </Typography>
                          </Alert>
                        )}
                        {hasPaymentDiscrepancy && (
                          <Alert severity="warning" sx={{ py: 0, px: 2 }}>
                            <Typography variant="body2">
                              <strong>Payment discrepancy:</strong> Calculated balance (₱{formatNumber(calculatedBalance)}) ≠ Recorded balance (₱{formatNumber(recordedBalance)}). Please verify against original document.
                            </Typography>
                          </Alert>
                        )}
                      </Box>
                    )}

                    {editMode && (
                      <Grid container spacing={1}>
                        <Grid size={{ xs: 6, sm: 3 }}>
                          <TextField 
                            fullWidth size="small" select
                            label="Payment Method" 
                            value={editedData?.payment_method || 'Cash'} 
                            onChange={(e) => handleEditChange('payment_method', e.target.value)}
                            variant="outlined"
                          >
                            <MenuItem key="Cash" value="Cash">Cash</MenuItem>
                            <MenuItem key="GCash" value="GCash">GCash</MenuItem>
                            <MenuItem key="Maya" value="Maya">Maya</MenuItem>
                          </TextField>
                        </Grid>
                        <Grid size={{ xs: 6, sm: 3 }}>
                          <TextField 
                            fullWidth size="small"
                            label="Grand Total" 
                            value={editedData?.grand_total || ''} 
                            onChange={(e) => handleEditChange('grand_total', e.target.value)}
                            InputProps={{ startAdornment: <InputAdornment position="start">₱</InputAdornment> }}
                            variant="outlined"
                          />
                        </Grid>
                        <Grid size={{ xs: 6, sm: 3 }}>
                          <TextField 
                            fullWidth size="small"
                            label="Downpayment" 
                            value={editedData?.downpayment || ''} 
                            onChange={(e) => handleEditChange('downpayment', e.target.value)}
                            InputProps={{ startAdornment: <InputAdornment position="start">₱</InputAdornment> }}
                            variant="outlined"
                          />
                        </Grid>
                        <Grid size={{ xs: 6, sm: 3 }}>
                          <TextField 
                            fullWidth size="small"
                            label="Balance" 
                            value={editedData?.balance || ''} 
                            onChange={(e) => handleEditChange('balance', e.target.value)}
                            InputProps={{ startAdornment: <InputAdornment position="start">₱</InputAdornment> }}
                            variant="outlined"
                          />
                        </Grid>
                      </Grid>
                    )}
                  </Box>
                );
              })()}
            </Box>

            {/* Action Bar */}
            <Divider />
            <Box sx={{ p: 2, display: 'flex', gap: 2, bgcolor: 'grey.100', alignItems: 'center', flexDirection: { xs: 'column', sm: 'row' } }}>
              {!editMode ? (
                <>
                  <Button 
                    variant="contained" 
                    color="success" 
                    size="medium"
                    startIcon={<CheckCircle />}
                    onClick={() => handleAction('approve')}
                    sx={{ flex: 1, py: 1, width: { xs: '100%', sm: 'auto' } }}
                  >
                    VALIDATE & SAVE
                  </Button>
                  <Button 
                    variant="contained" 
                    color="primary" 
                    size="medium"
                    startIcon={<Edit />}
                    onClick={startEdit}
                    sx={{ flex: 1, py: 1, width: { xs: '100%', sm: 'auto' } }}
                  >
                    EDIT DATA
                  </Button>
                  <Button 
                    variant="contained" 
                    color="error" 
                    size="medium"
                    startIcon={<Cancel />}
                    onClick={() => handleAction('reject')}
                    sx={{ flex: 1, py: 1, width: { xs: '100%', sm: 'auto' } }}
                  >
                    REJECT / FLAG
                  </Button>
                </>
              ) : (
                <>
                  <Button 
                    variant="contained" 
                    color="primary" 
                    size="medium"
                    startIcon={<CheckCircle />}
                    onClick={() => handleAction('correct')}
                    sx={{ flex: 1, py: 1, width: { xs: '100%', sm: 'auto' } }}
                  >
                    Save Corrections
                  </Button>
                  <Button 
                    variant="contained" 
                    color="inherit" 
                    size="medium"
                    onClick={() => setEditMode(false)}
                    sx={{ flex: 1, py: 1, width: { xs: '100%', sm: 'auto' } }}
                  >
                    Cancel Edit
                  </Button>
                </>
              )}
            </Box>
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
}
