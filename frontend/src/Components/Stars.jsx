import React from 'react'

const Stars = ({stars}) => {
    const ratingStar=Array.from({length:5 },(elm,index) => {
        let number = index+0.5;
        return(
            <span key={index}>
                {stars >= index+1 ? 
                    <i className="bi bi-star-fill text-warning"></i>
                : stars >= number ? 
                    <i className="bi bi-star-half text-warning  "></i>
                : 
                    <i className="bi bi-star text-warning"></i>
                }
            </span>
        );
    })
  return (
    <div>
      {ratingStar}
    </div>
  )
}

export default Stars
