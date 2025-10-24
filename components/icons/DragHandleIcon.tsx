import React from 'react';

const DragHandleIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...props}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 9h16.5m-16.5 6.75h16.5" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 3.75h4.5M9.75 20.25h4.5" transform="rotate(90 12 12)" />
  </svg>
);

export default DragHandleIcon;
