package errors

import "github.com/pkg/errors"

func New(message string) error {
	return &customError{}
}

type customError struct{}

func (e *customError) Error() string {
	return "boom"
}

func Wrap(err error, message string) error {
	return errors.Wrap(err, message)
}

func Is(err error, target error) bool {
	return errors.Is(err, target)
}
