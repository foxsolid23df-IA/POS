import { supabase } from '../supabase';

const downloadText = (content, filename, mimeType) => {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

const csvEscape = (value) => {
  const text = value === null || value === undefined ? '' : String(value);
  return `"${text.replace(/"/g, '""')}"`;
};

export const backupService = {
  exportStoreBackup: async () => {
    const { data, error } = await supabase.rpc('export_store_backup');
    if (error) throw error;
    return data;
  },

  downloadBackupJson: async () => {
    const backup = await backupService.exportStoreBackup();
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    downloadText(
      JSON.stringify(backup, null, 2),
      `nexum-pos-backup-${stamp}.json`,
      'application/json;charset=utf-8'
    );
    return backup;
  },

  downloadInventoryCsv: async () => {
    const { data, error } = await supabase
      .from('products')
      .select('id, barcode, box_barcode, name, stock, unit, box_units, price, box_price, box_special_price, box_special_from_qty, sell_by_box_only, cost_price, margin_percent, supplier, updated_at')
      .order('name', { ascending: true });

    if (error) throw error;

    const headers = [
      'ID',
      'Codigo',
      'Codigo Caja',
      'Producto',
      'Stock',
      'Unidad',
      'Pzas Caja',
      'Precio',
      'Precio Caja',
      'Precio Especial Caja',
      'Especial Caja Desde',
      'Solo Caja',
      'Costo',
      'Margen',
      'Proveedor',
      'Actualizado',
    ];

    const rows = (data || []).map((p) => [
      p.id,
      p.barcode,
      p.box_barcode,
      p.name,
      p.stock,
      p.unit,
      p.box_units,
      p.price,
      p.box_price,
      p.box_special_price,
      p.box_special_from_qty,
      p.sell_by_box_only ? 'SI' : 'NO',
      p.cost_price,
      p.margin_percent,
      p.supplier,
      p.updated_at,
    ].map(csvEscape).join(','));

    const stamp = new Date().toISOString().slice(0, 10);
    downloadText([headers.map(csvEscape).join(','), ...rows].join('\n'), `inventario-${stamp}.csv`, 'text/csv;charset=utf-8');
    return data || [];
  },
};
