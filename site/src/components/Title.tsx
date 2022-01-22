import React from 'react';
import styled from 'styled-components';
import { media } from './Layout';

type Props = { small?: boolean };

const Wrapper = styled.h1<Props>`
    display: block;
    font-size: ${({ small }) => (small ? '60px' : '70px')};
    line-height: 1;
    margin: 10px auto 0;

    @media ${media.midUp} {
        font-size: ${({ small }) => (small ? '100px' : '140px')};
    }
`;

const Holder = styled.span`
  background: linear-gradient(to bottom right,
  #28ea6b,
  #003e81,
  #2b02f6);
  background-clip: text;
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  padding: 0 10px;
`;

export const Title: React.FC<Props> = ({ children, small }) => {
    return (
        <Wrapper small={small}>
            <Holder>{children}</Holder>
        </Wrapper>
    );
};
