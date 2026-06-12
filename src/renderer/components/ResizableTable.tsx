import React, { useState, useCallback } from 'react';
import { Table } from 'antd';
import type { TableProps } from 'antd';

/**
 * 컬럼 너비 조절 가능한 Table 래퍼
 * 사용법: <ResizableTable columns={columns} dataSource={data} ... />
 * 각 column에 width가 지정되어 있어야 드래그 조절 가능
 */
const ResizableTitle = (props: any) => {
  const { onResize, width, ...restProps } = props;
  if (!width || !onResize) {
    return <th {...restProps} />;
  }
  return (
    <th
      {...restProps}
      style={{
        ...restProps.style,
        cursor: 'col-resize',
        userSelect: 'none',
      }}
      onMouseDown={(e: React.MouseEvent) => {
        const startX = e.pageX;
        const startWidth = width;
        const onMouseMove = (ev: MouseEvent) => {
          const diff = ev.pageX - startX;
          const newWidth = Math.max(50, startWidth + diff);
          onResize(newWidth);
        };
        const onMouseUp = () => {
          document.removeEventListener('mousemove', onMouseMove);
          document.removeEventListener('mouseup', onMouseUp);
          document.body.style.cursor = '';
          document.body.style.userSelect = '';
        };
        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp);
        document.body.style.cursor = 'col-resize';
        document.body.style.userSelect = 'none';
        e.preventDefault();
      }}
    />
  );
};

function ResizableTable<T extends object>(props: TableProps<T>) {
  const { columns: initialColumns, ...rest } = props;
  const [colWidths, setColWidths] = useState<Record<string, number>>({});

  const handleResize = useCallback((key: string, newWidth: number) => {
    setColWidths(prev => ({ ...prev, [key]: newWidth }));
  }, []);

  const columns = (initialColumns || []).map((col: any) => {
    const key = col.key || col.dataIndex || '';
    // width 없으면 기본값 150 (모든 컬럼 드래그 가능하게)
    const width = colWidths[key] || col.width || 150;
    return {
      ...col,
      width,
      onHeaderCell: () => ({
        width,
        onResize: (w: number) => handleResize(key, w),
      }),
    };
  });

  return (
    <Table
      {...rest}
      columns={columns}
      components={{ header: { cell: ResizableTitle } }}
    />
  );
}

export default ResizableTable;
