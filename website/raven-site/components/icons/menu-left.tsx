import React, {SVGProps} from 'react';

type IconProps = SVGProps<SVGSVGElement> & {
	secondaryfill?: string;
	strokewidth?: number;
	title?: string;
}

function MenuLeft({fill = 'currentColor', secondaryfill, ...props}: IconProps) {
	secondaryfill = secondaryfill || fill;

	return (
		<svg height="20" width="20" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg" {...props}>
	<g fill={fill}>
		<line fill="none" stroke={secondaryfill} strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" x1="17" x2="3" y1="10" y2="10"/>
		<line fill="none" stroke={fill} strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" x1="17" x2="3" y1="5" y2="5"/>
		<line fill="none" stroke={fill} strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" x1="10" x2="3" y1="15" y2="15"/>
	</g>
</svg>
	);
};

export default MenuLeft;